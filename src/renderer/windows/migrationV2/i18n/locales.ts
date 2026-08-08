/**
 * Migration window translations
 * Supports Chinese (zh-CN) and English (en-US)
 */

export const zhCN = {
  common: { close: '', error: '', loading: '', success: '' },
  error: { unknown: '' },
  settings: {
    theme: {
      dark: '',
      light: '',
      system: ''
    }
  },
  migration: {
    title: '',
    stages: {
      introduction: '',
      migration: '',
      completed: ''
    },
    buttons: {
      start_migration: '',
      restart: '',
      retry: '',
      close: '',
      continue_v1: ' V1',
      ignore_migration: '',
      skip_migration: '',
      more_options: ''
    },
    window: {
      minimize: '',
      close: '',
      confirm_close: {
        title: '',
        message: '',
        continue: '',
        quit: '',
        quit_pending: '…'
      }
    },
    language: {
      select: ''
    },
    status: {
      pending: '',
      running: '',
      completed: '',
      failed: ''
    },
    diagnostics: {
      title: '',
      save: '',
      saving: '…',
      export_description:
        ' SuperAgent ',
      open_from_error: '',
      saved_title: '',
      privacy:
        ' SuperAgent ',
      saved_local: '',
      logs_not_included: '',
      open_folder: '',
      contact: '',
      copy_success: '',
      copy_failed: '',
      save_failed: '',
      open_folder_failed: ''
    },
    more_options: {
      description: '',
      diagnostics_title: '',
      use_v2_title: ' V2',
      skip_description: '',
      continue_v1_description: ' V1',
      diagnostics_description: ''
    },
    introduction: {
      title: '',
      subtitle: 'SuperAgent V2 · ',
      features: {
        architecture: {
          title: '',
          description: ''
        },
        migration: {
          title: '',
          description: ' V2 '
        },
        safety: {
          title: '',
          description: ''
        }
      },
      data_location: '{{path}}'
    },
    skip_dialog: {
      title: '',
      warning_prefix: '',
      warning_body: '',
      points: {
        cleared_strong: '',
        cleared_rest: '',
        retained_strong: '',
        retained_rest: '',
        files: '',
        skip_before: '',
        skip_strong: '',
        skip_after: ''
      },
      cancel: '',
      confirm: '',
      confirm_countdown: ' ({{seconds}}s)',
      failed: ''
    },
    migration: {
      title: '...',
      do_not_close: '…'
    },
    progress: {
      processing: '{{name}}...',
      migrated_boot_config: ' {{processed}}/{{total}} ',
      migrated_chats: ' {{processed}}/{{total}} {{messages}} ',
      migrated_preferences: ' {{processed}}/{{total}} ',
      migrated_knowledge: ' {{processed}}/{{total}} ',
      migrated_knowledge_vectors: ' {{processed}}/{{total}} ',
      migrated_assistants: ' {{processed}}/{{total}} ',
      migrated_files: ' {{processed}}/{{total}} ',
      migrated_mcp_servers: ' {{processed}}/{{total}}  MCP ',
      migrated_miniapps: ' {{processed}}/{{total}} ',
      migrated_translate_languages: ' {{processed}}/{{total}} ',
      migrated_translate_history: ' {{processed}}/{{total}} ',
      prepared_chats: ' {{processed}}/{{total}} ',
      agents_claude_config: ' Agent …',
      agents_claude_config_scanning_start: ' Agent …',
      agents_claude_config_scanning: ' Agent {{processed}}/{{total}} {{byteCount}}/{{byteTotal}}',
      agents_claude_config_copying: ' Agent {{processed}}/{{total}} {{byteCount}}/{{byteTotal}}',
      agents_claude_config_verifying:
        ' Agent {{processed}}/{{total}} {{byteCount}}/{{byteTotal}}',
      agents_messages: ' Agent  {{processed}}/{{total}}…',
      agents_database: ' Agent …',
      agents_id_mapping: ' Agent …',
      agents_identity: ' Agent  {{processed}}/{{total}}…',
      agents_workspaces: ' Agent  {{processed}}/{{total}}…',
      agents_claude_cache: ' Agent  {{processed}}/{{total}}…',
      agents_validation: ' Agent …'
    },
    completed: {
      title: ' SuperAgent V2',
      description: ' V2',
      steps_label: '',
      items_label: '',
      duration_label: '',
      warning_heading: '{{count}} ',
      warning_description: '',
      warning_copy: '',
      warning_copy_success: '',
      warning_copy_failed: ''
    },
    error: {
      title: '',
      description: '',
      error_prefix: '',
      unknown: '',
      v1_fallback: {
        title: ' V1',
        description: ' V1 ',
        download: ' V1 ',
        dismiss: '',
        open_failed: ''
      }
    },
    version_incompatible: {
      title: '',
      preamble: 'SuperAgent ',
      no_version_log:
        ' {{requiredVersion}} ',
      v1_too_old:
        '{{previousVersion}} {{requiredVersion}} ',
      v2_gateway_skipped:
        ' {{previousVersion}}  {{currentVersion}} {{gatewayVersion}} ',
      ignore_hint: ''
    }
  }
}

export const enUS = {
  common: { close: 'Close', error: 'Error', loading: 'Loading', success: 'Success' },
  error: { unknown: 'Unknown error' },
  settings: {
    theme: {
      dark: 'Dark mode',
      light: 'Light mode',
      system: 'System'
    }
  },
  migration: {
    title: 'Data Migration Wizard',
    stages: {
      introduction: 'Introduction',
      migration: 'Migration',
      completed: 'Completed'
    },
    buttons: {
      start_migration: 'Start Migration',
      restart: 'Restart App',
      retry: 'Retry',
      close: 'Close App',
      continue_v1: 'Continue using V1',
      ignore_migration: 'Ignore and Use Defaults',
      skip_migration: 'Skip migration',
      more_options: 'More options'
    },
    window: {
      minimize: 'Minimize',
      close: 'Close',
      confirm_close: {
        title: 'Exit data migration',
        message:
          "Migration isn't finished yet. Closing the window will quit the app and you'll need to start over next launch. Quit anyway?",
        continue: 'Continue migration',
        quit: 'Quit',
        quit_pending: 'The app will close automatically once the current step finishes…'
      }
    },
    language: {
      select: 'Switch language'
    },
    status: {
      pending: 'Pending',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed'
    },
    diagnostics: {
      title: 'Save troubleshooting file',
      save: 'Save diagnostic bundle',
      saving: 'Saving…',
      export_description:
        'The bundle includes migration errors, system information, and available application logs. Logs may contain file paths, error stacks, user content, or credentials. It is saved locally and never uploaded automatically; share it only with SuperAgent support.',
      open_from_error: 'Export a diagnostic bundle for this error',
      saved_title: 'Diagnostic bundle saved',
      privacy:
        'Application logs may contain file paths, error stacks, user content, or credentials. Do not share them publicly or with anyone outside the SuperAgent support team.',
      saved_local:
        'The diagnostic bundle was saved locally and was not uploaded automatically. Please send it to the feedback email to help us investigate.',
      logs_not_included:
        'Application logs could not be included. This diagnostic bundle contains only system information.',
      open_folder: 'Open file location',
      contact: 'Copy feedback email',
      copy_success: 'Feedback email copied',
      copy_failed: 'Failed to copy feedback email',
      save_failed: 'Could not save diagnostic bundle',
      open_folder_failed: 'Could not open file location'
    },
    more_options: {
      description: 'Choose how you want to continue. Your original V1 data will not be deleted either way.',
      diagnostics_title: 'Save troubleshooting information',
      use_v2_title: 'Use V2 without importing V1 data',
      skip_description: 'Start with default settings without importing your V1 data.',
      continue_v1_description: 'Download and install V1 to keep using your original data.',
      diagnostics_description: 'Save errors and app logs locally so you can share them with support.'
    },
    introduction: {
      title: 'Migrate Data to New Architecture',
      subtitle: 'SuperAgent V2 · New Data Architecture',
      features: {
        architecture: {
          title: 'New Data Architecture',
          description: 'Storage and usage are rebuilt for major gains in efficiency and security.'
        },
        migration: {
          title: 'Migration Required',
          description: 'Legacy data must be migrated before it can be used in V2.'
        },
        safety: {
          title: 'Safe and Retryable',
          description: 'Your legacy data stays on disk, so you can retry if a migration fails.'
        }
      },
      data_location: 'Data migration directory: {{path}}'
    },
    skip_dialog: {
      title: 'Skip Data Migration',
      warning_prefix: 'High-risk action: ',
      warning_body: 'Starts with default settings, and migration will not be prompted again.',
      points: {
        cleared_strong: 'Records already migrated to the new database will be cleared',
        cleared_rest: ' (if any), and the new version will start with default data.',
        retained_strong: 'Original legacy data will not be deleted',
        retained_rest:
          ' and remains on disk, but chats, settings, knowledge bases, and related content will not appear in the new version.',
        files:
          'Files copied during migration may still take up disk space, but they will not appear in the new version.',
        skip_before: 'Continue only if you are sure you want to ',
        skip_strong: 'skip this automatic migration',
        skip_after: '.'
      },
      cancel: 'Cancel',
      confirm: 'I understand the risk, skip and restart',
      confirm_countdown: 'I understand the risk, skip and restart ({{seconds}}s)',
      failed: 'Failed to skip migration. Please try again.'
    },
    migration: {
      title: 'Migrating Data...',
      do_not_close: 'Migration in progress, please do not close the app…'
    },
    progress: {
      processing: 'Processing {{name}}...',
      migrated_boot_config: 'Migrated {{processed}}/{{total}} boot config items',
      migrated_chats: 'Migrated {{processed}}/{{total}} conversations, {{messages}} messages',
      migrated_preferences: 'Migrated {{processed}}/{{total}} preferences',
      migrated_knowledge: 'Migrated {{processed}}/{{total}} knowledge records',
      migrated_knowledge_vectors: 'Migrated {{processed}}/{{total}} knowledge vector work units',
      migrated_assistants: 'Migrated {{processed}}/{{total}} assistants',
      migrated_files: 'Migrated {{processed}}/{{total}} files',
      migrated_mcp_servers: 'Migrated {{processed}}/{{total}} MCP servers',
      migrated_miniapps: 'Migrated {{processed}}/{{total}} mini apps',
      migrated_translate_languages: 'Migrated {{processed}}/{{total}} translate languages',
      migrated_translate_history: 'Migrated {{processed}}/{{total}} translate history records',
      prepared_chats: 'Prepared {{processed}}/{{total}} conversations',
      agents_claude_config: 'Migrating Agent configuration…',
      agents_claude_config_scanning_start: 'Counting Agent configuration files…',
      agents_claude_config_scanning:
        'Scanning Agent configuration: {{processed}}/{{total}} files, {{byteCount}}/{{byteTotal}}',
      agents_claude_config_copying:
        'Migrating Agent configuration: {{processed}}/{{total}} files, {{byteCount}}/{{byteTotal}}',
      agents_claude_config_verifying:
        'Verifying Agent configuration: {{processed}}/{{total}} files, {{byteCount}}/{{byteTotal}}',
      agents_messages: 'Preparing Agent messages {{processed}}/{{total}}…',
      agents_database: 'Importing Agent database records…',
      agents_id_mapping: 'Updating Agent and Session identifiers…',
      agents_identity: 'Migrating Agent identity files {{processed}}/{{total}}…',
      agents_workspaces: 'Migrating Agent workspaces {{processed}}/{{total}}…',
      agents_claude_cache: 'Migrating Agent session cache {{processed}}/{{total}}…',
      agents_validation: 'Validating migrated Agent data…'
    },
    completed: {
      title: 'Welcome to SuperAgent V2',
      description: 'Migration is complete. Your data is ready. Restart the app to start using V2.',
      steps_label: 'Steps completed',
      items_label: 'Migration items',
      duration_label: 'Migration time',
      warning_heading: '{{count}} migration notice(s)',
      warning_description: 'Migration completed, but the following items need attention.',
      warning_copy: 'Copy all notices',
      warning_copy_success: 'Migration notices copied',
      warning_copy_failed: 'Failed to copy migration notices'
    },
    error: {
      title: 'Migration Failed',
      description: 'Migration did not finish, but your original data remains intact.',
      error_prefix: 'Error: ',
      unknown: 'Unknown error',
      v1_fallback: {
        title: 'Download and Continue Using V1',
        description: 'Your original data is intact. Download and install V1 to keep working.',
        download: 'Download V1',
        dismiss: 'Got it',
        open_failed: 'Could not open the download page'
      }
    },
    version_incompatible: {
      title: 'Version Upgrade Required',
      preamble:
        'SuperAgent has undergone a major data storage refactoring. To ensure safe migration of your data, we have strict requirements on the upgrade order.',
      no_version_log:
        'Cannot determine your previous version. Please install version {{requiredVersion}} first and run it at least once, then install this version to complete the data migration.',
      v1_too_old:
        'Your previous version ({{previousVersion}}) is too old to migrate directly. Please install version {{requiredVersion}} first, then install this version.',
      v2_gateway_skipped:
        'Cannot upgrade directly from {{previousVersion}} to {{currentVersion}}. Please install version {{gatewayVersion}} first to complete the data migration, then upgrade to this version.',
      ignore_hint: 'You can also choose to ignore old data and start fresh with default settings.'
    }
  }
}
