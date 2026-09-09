"""
train_models.py

Trains the four ML models specified in the Bharat AeroTwin architecture,
using the synthetic dataset produced by scripts/generate_synthetic_data.js.

Models:
  1. Fault Detection      -> RandomForestClassifier / XGBoost (multi-class)
  2. Anomaly Detection    -> IsolationForest (unsupervised, trained on Normal-only data)
  3. SOH Estimation       -> LSTM/GRU regression (sequence -> scalar 0-100)
  4. RUL Prediction       -> LSTM/GRU regression (sequence -> scalar, remaining seconds/minutes)

Expected input: a JSON or CSV file where each row is one simulated timestep with columns:
  timestamp, rpm, cht, egt, oil_pressure, oil_temp, fuel_flow, fuel_pressure, map, vibration,
  fault_label, soh_true, rul_true, flight_id

ADAPT the CONFIG section below to match your actual generate_synthetic_data.js output schema.

Usage:
  pip install scikit-learn xgboost tensorflow pandas numpy joblib --break-system-packages
  python train_models.py --data synthetic_dataset.json --out models/
"""

import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report, mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    import tensorflow as tf
    from tensorflow.keras import layers, models
    HAS_TF = True
except ImportError:
    HAS_TF = False


# ---------------------------------------------------------------------------
# CONFIG — adjust to match your dataset's actual column names
# ---------------------------------------------------------------------------
SENSOR_COLS = [
    "rpm", "cht", "egt", "oil_pressure", "oil_temp",
    "fuel_flow", "fuel_pressure", "map", "vibration",
]
FAULT_LABEL_COL = "fault_label"       # categorical: normal, low_oil_pressure, high_cht, ...
SOH_COL = "soh_true"                  # 0-100 synthetic ground truth
RUL_COL = "rul_true"                  # seconds/minutes remaining, synthetic ground truth
FLIGHT_ID_COL = "flight_id"           # groups rows into sequences per simulated flight
SEQUENCE_LENGTH = 30                  # timesteps of history fed to the LSTM/GRU


def load_dataset(path: str) -> pd.DataFrame:
    if path.endswith(".json"):
        with open(path) as f:
            data = json.load(f)
        df = pd.DataFrame(data)
    else:
        df = pd.read_csv(path)
    missing = [c for c in SENSOR_COLS + [FAULT_LABEL_COL, SOH_COL, RUL_COL, FLIGHT_ID_COL] if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset is missing expected columns: {missing}. "
            f"Update CONFIG in train_models.py to match your generate_synthetic_data.js schema."
        )
    return df


# ---------------------------------------------------------------------------
# 1. Fault Detection — RandomForest (+ XGBoost if available)
# ---------------------------------------------------------------------------
def train_fault_detector(df: pd.DataFrame, out_dir: str):
    X = df[SENSOR_COLS].values
    y = df[FAULT_LABEL_COL].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)

    rf = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, class_weight="balanced")
    rf.fit(X_train_s, y_train)
    print("\n=== Random Forest — Fault Detection ===")
    print(classification_report(y_test, rf.predict(X_test_s)))

    joblib.dump(rf, os.path.join(out_dir, "fault_detector_rf.joblib"))
    joblib.dump(scaler, os.path.join(out_dir, "fault_detector_scaler.joblib"))

    if HAS_XGB:
        # XGBoost needs integer-encoded labels
        classes = sorted(set(y_train))
        label_to_idx = {c: i for i, c in enumerate(classes)}
        y_train_idx = np.array([label_to_idx[v] for v in y_train])
        y_test_idx = np.array([label_to_idx[v] for v in y_test])

        xgb_clf = xgb.XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            objective="multi:softprob", num_class=len(classes), eval_metric="mlogloss"
        )
        xgb_clf.fit(X_train_s, y_train_idx)
        print("\n=== XGBoost — Fault Detection ===")
        print(classification_report(y_test_idx, xgb_clf.predict(X_test_s)))

        joblib.dump(xgb_clf, os.path.join(out_dir, "fault_detector_xgb.joblib"))
        joblib.dump(classes, os.path.join(out_dir, "fault_detector_classes.joblib"))
    else:
        print("\n(xgboost not installed — skipping XGBoost model; RandomForest is sufficient for the prototype)")


# ---------------------------------------------------------------------------
# 2. Anomaly Detection — Isolation Forest (trained on Normal-only data)
# ---------------------------------------------------------------------------
def train_anomaly_detector(df: pd.DataFrame, out_dir: str):
    normal_df = df[df[FAULT_LABEL_COL] == "normal"]
    if normal_df.empty:
        raise ValueError('No rows with fault_label == "normal" found — check your label naming.')

    X = normal_df[SENSOR_COLS].values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    iso = IsolationForest(n_estimators=200, contamination=0.02, random_state=42)
    iso.fit(X_s)

    # Sanity-check: it should flag most non-normal rows as anomalies
    faulty_df = df[df[FAULT_LABEL_COL] != "normal"]
    if not faulty_df.empty:
        X_faulty_s = scaler.transform(faulty_df[SENSOR_COLS].values)
        preds = iso.predict(X_faulty_s)  # -1 = anomaly, 1 = normal
        flagged_rate = (preds == -1).mean()
        print(f"\n=== Isolation Forest — Anomaly Detection ===")
        print(f"Flagged {flagged_rate:.1%} of known-faulty rows as anomalous (higher is better)")

    joblib.dump(iso, os.path.join(out_dir, "anomaly_detector_iso.joblib"))
    joblib.dump(scaler, os.path.join(out_dir, "anomaly_detector_scaler.joblib"))


# ---------------------------------------------------------------------------
# 3 & 4. SOH / RUL — sequence models (LSTM/GRU)
# ---------------------------------------------------------------------------
def build_sequences(df: pd.DataFrame, target_col: str):
    """Group rows by flight_id, build fixed-length sliding-window sequences."""
    X_seqs, y_vals = [], []
    for _, flight_df in df.groupby(FLIGHT_ID_COL):
        flight_df = flight_df.sort_values("timestamp") if "timestamp" in flight_df.columns else flight_df
        sensor_arr = flight_df[SENSOR_COLS].values
        target_arr = flight_df[target_col].values
        if len(sensor_arr) < SEQUENCE_LENGTH:
            continue
        for i in range(len(sensor_arr) - SEQUENCE_LENGTH):
            X_seqs.append(sensor_arr[i:i + SEQUENCE_LENGTH])
            y_vals.append(target_arr[i + SEQUENCE_LENGTH])  # predict the value right after the window
    return np.array(X_seqs), np.array(y_vals)


def build_gru_regressor(input_shape):
    model = models.Sequential([
        layers.Input(shape=input_shape),
        layers.GRU(64, return_sequences=True),
        layers.GRU(32),
        layers.Dense(16, activation="relu"),
        layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    return model


def train_sequence_model(df: pd.DataFrame, target_col: str, model_name: str, out_dir: str, epochs: int = 30):
    if not HAS_TF:
        print(f"\n(tensorflow not installed — skipping {model_name} model. "
              f"pip install tensorflow --break-system-packages)")
        return

    X, y = build_sequences(df, target_col)
    if len(X) == 0:
        print(f"\nNot enough per-flight rows (need >= {SEQUENCE_LENGTH}) to build sequences for {model_name}. "
              f"Generate more/longer synthetic flights.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Scale features (fit on train, flatten/reshape around the scaler)
    n_features = X_train.shape[-1]
    feat_scaler = StandardScaler().fit(X_train.reshape(-1, n_features))
    X_train_s = feat_scaler.transform(X_train.reshape(-1, n_features)).reshape(X_train.shape)
    X_test_s = feat_scaler.transform(X_test.reshape(-1, n_features)).reshape(X_test.shape)

    model = build_gru_regressor((SEQUENCE_LENGTH, n_features))
    model.fit(
        X_train_s, y_train,
        validation_split=0.15,
        epochs=epochs,
        batch_size=64,
        verbose=2,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)],
    )

    preds = model.predict(X_test_s).flatten()
    mae = mean_absolute_error(y_test, preds)
    print(f"\n=== GRU — {model_name} ===")
    print(f"Test MAE: {mae:.3f}")

    model.save(os.path.join(out_dir, f"{model_name.lower()}_gru.keras"))
    joblib.dump(feat_scaler, os.path.join(out_dir, f"{model_name.lower()}_scaler.joblib"))


# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to synthetic dataset (json or csv)")
    parser.add_argument("--out", default="models/", help="Output directory for trained models")
    parser.add_argument("--epochs", type=int, default=30, help="Epochs for SOH/RUL sequence models")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    df = load_dataset(args.data)
    print(f"Loaded {len(df)} rows across {df[FLIGHT_ID_COL].nunique()} simulated flights.")

    train_fault_detector(df, args.out)
    train_anomaly_detector(df, args.out)
    train_sequence_model(df, SOH_COL, "SOH", args.out, epochs=args.epochs)
    train_sequence_model(df, RUL_COL, "RUL", args.out, epochs=args.epochs)

    print(f"\nAll models written to {args.out}")


if __name__ == "__main__":
    main()
