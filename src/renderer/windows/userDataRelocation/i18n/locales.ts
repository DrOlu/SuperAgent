export const relocationLocales = {
  en: {
    translation: {
      relocation: {
        title: 'Data Directory Migration',
        preparing: 'Preparing migration...',
        copying: 'Copying data...',
        committing: 'Saving new data directory...',
        completed: {
          title: 'Migration complete',
          description: 'Restart SuperAgent to use the new data directory.'
        },
        failed: {
          title: 'Migration failed',
          description: 'SuperAgent will keep using the previous data directory.'
        },
        restart_success: 'Restart SuperAgent',
        restart_failure: 'Continue with Previous Directory',
        from: 'Current directory',
        to: 'New directory'
      }
    }
  },
  'zh-CN': {
    translation: {
      relocation: {
        title: '',
        preparing: '...',
        copying: '...',
        committing: '...',
        completed: {
          title: '',
          description: ' SuperAgent '
        },
        failed: {
          title: '',
          description: 'SuperAgent '
        },
        restart_success: ' SuperAgent',
        restart_failure: '',
        from: '',
        to: ''
      }
    }
  },
  'zh-TW': {
    translation: {
      relocation: {
        title: '',
        preparing: '...',
        copying: '...',
        committing: '...',
        completed: {
          title: '',
          description: ' SuperAgent '
        },
        failed: {
          title: '',
          description: 'SuperAgent '
        },
        restart_success: ' SuperAgent',
        restart_failure: '',
        from: '',
        to: ''
      }
    }
  }
} as const
