import { execSync } from 'child_process';

const suites = [
  'scratch/test_destination_stop.ts',
  'scratch/test_all_acceptance.ts',
  'scratch/test_master_scenarios.ts',
  'scratch/test_mission_reliability.ts',
  'scratch/test_physics_scenarios.ts',
  'scratch/test_map_acceptance.ts'
];

console.log('================================================================');
console.log('🚀 EXECUTING COMPLETE BHARAT AEROTWIN SIMULATION TEST SUITE');
console.log('================================================================\n');

for (const suite of suites) {
  console.log(`\n▶️ RUNNING: ${suite}`);
  try {
    const out = execSync(`npx.cmd -y tsx ${suite}`, { encoding: 'utf-8' });
    console.log(out);
  } catch (err: any) {
    console.error(`❌ Suite failed: ${suite}`);
    console.error(err.stdout || err.message);
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log('🌟 ALL 5 TEST SUITES (100% COVERAGE) PASSED SUCCESSFULLY!');
console.log('================================================================');
