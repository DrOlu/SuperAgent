#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function checkDuplicatesAndChildren() {
  const classificationFile = path.join(__dirname, '../data/classification.json')
  const classification = JSON.parse(fs.readFileSync(classificationFile, 'utf8'))

  // preferenceschildren
  const allPrefs = []

  function extractItems(items, source, category, parentKey = '') {
    if (!Array.isArray(items)) return

    items.forEach((item) => {
      // children
      if (item.children) {
        console.log(`children: ${source}/${category}/${item.originalKey}`)
        extractItems(item.children, source, category, `${parentKey}${item.originalKey}.`)
        return
      }

      // 
      if (item.category === 'preferences' && item.status === 'classified' && item.targetKey) {
        allPrefs.push({
          source,
          category,
          originalKey: parentKey + item.originalKey,
          targetKey: item.targetKey,
          fullPath: `${source}/${category}/${parentKey}${item.originalKey}`
        })
      }
    })
  }
  // 
  ;['electronStore', 'redux', 'localStorage'].forEach((source) => {
    if (classification.classifications[source]) {
      Object.keys(classification.classifications[source]).forEach((category) => {
        const items = classification.classifications[source][category]
        extractItems(items, source, category)
      })
    }
  })

  console.log(`\n===  ${allPrefs.length} preferences ===\n`)

  // targetKey
  const targetKeyGroups = {}
  allPrefs.forEach((pref) => {
    if (!targetKeyGroups[pref.targetKey]) {
      targetKeyGroups[pref.targetKey] = []
    }
    targetKeyGroups[pref.targetKey].push(pref)
  })

  // 
  const duplicates = Object.keys(targetKeyGroups).filter((key) => targetKeyGroups[key].length > 1)
  if (duplicates.length > 0) {
    console.log('=== targetKey ===')
    duplicates.forEach((targetKey) => {
      console.log(`\n${targetKey}:`)
      targetKeyGroups[targetKey].forEach((pref) => {
        console.log(`  - ${pref.fullPath}`)
      })
    })
  } else {
    console.log('✅ targetKey')
  }

  return { allPrefs, duplicates: duplicates.map((key) => targetKeyGroups[key]) }
}

if (require.main === module) {
  checkDuplicatesAndChildren()
}

module.exports = checkDuplicatesAndChildren
