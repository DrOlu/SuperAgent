#!/usr/bin/env node

const PreferencesGenerator = require('./generate-preferences')
const BootConfigGenerator = require('./generate-boot-config')
const MigrationGenerator = require('./generate-migration')

async function generateAll() {
  console.log('🚀 ...\n')

  try {
    // 1: preferences.ts
    console.log('📋  1/3: preferences.ts')
    const preferencesGenerator = new PreferencesGenerator()
    preferencesGenerator.generate()
    console.log('✅ preferences.ts \n')

    // 2: bootConfigSchemas.ts
    console.log('📋  2/3: bootConfigSchemas.ts')
    const bootConfigGenerator = new BootConfigGenerator()
    bootConfigGenerator.generate()
    console.log('✅ bootConfigSchemas.ts \n')

    // 3: 
    console.log('🔄  3/3: ')
    const migrationGenerator = new MigrationGenerator()
    migrationGenerator.generate()
    console.log('✅ \n')

    // 
    console.log('🎉 ')
    console.log('\n📝 :')
    console.log('   - src/shared/data/preference/preferenceSchemas.ts')
    console.log('   - src/shared/data/bootConfig/bootConfigSchemas.ts')
    console.log('   - src/main/data/migration/v2/migrators/mappings/PreferencesMappings.ts')
    console.log('   - src/main/data/migration/v2/migrators/mappings/BootConfigMappings.ts')

    console.log('\n🔧 :')
    console.log('   1.  pnpm typecheck ')
    console.log('   2.  pnpm lint ')
    console.log('   3. ')
  } catch (error) {
    console.error('❌ :', error.message)
    process.exit(1)
  }
}

// 
if (require.main === module) {
  generateAll()
}

module.exports = generateAll
