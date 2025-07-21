// src/lib/geminiRunner.ts
import {
  loadSettings,
  SettingScope,
  USER_SETTINGS_PATH,
} from '../config/settings.js';
import { loadCliConfig } from '../config/config.js';
import { loadExtensions } from '../config/extension.js';
import { runNonInteractive } from '../nonInteractiveCli.js';
import { Extension } from '../config/extension.js';
import { AuthType, Config } from '@google/gemini-cli-core';
import { validateAuthMethod } from '../config/auth.js';

type CliArgs = {
  model?: string;
  sandbox?: boolean;
  sandboxImage?: string;
  debug?: boolean;
};

export async function generateGemini(prompt: string, interactive = false): Promise<string> {
  const cwd = process.cwd();
  const settings = loadSettings(cwd);
  const extensions = loadExtensions(cwd);

  if (settings.errors.length > 0) {
    throw new Error(
      settings.errors.map((e) => `Erreur dans ${e.path}: ${e.message}`).join('\n')
    );
  }

  let authType = process.env.GEMINI_API_KEY ? AuthType.USE_GEMINI : undefined;

  if (!authType) {
    throw new Error(
      `Aucune méthode d'auth. Configure ${USER_SETTINGS_PATH} ou définis GEMINI_API_KEY`
    );
  }

  console.log('authType:', authType);

  const defaultCliArgs: import('../config/config.js').CliArgs = {
    model: settings.merged.model || 'gemini-2.5-pro',
    sandbox: false,
    sandboxImage: undefined,
    debug: false,
    prompt: '',
    promptInteractive: '',
    allFiles: false,
    all_files: false,
    extensions: [],
    allowedMcpServerNames: [],
    yolo: true,
    showMemoryUsage: false,
    show_memory_usage: false,
    telemetry: false,
    telemetryTarget: undefined,
    telemetryOtlpEndpoint: undefined,
    telemetryLogPrompts: undefined,
    checkpointing: false,
    proxy: undefined,
    experimentalAcp: false,
    listExtensions: false,
    ideMode: false,
  };

  const config = await loadCliConfig(settings.merged, extensions, 'session-id', defaultCliArgs);

  const err = validateAuthMethod(authType);
  if (err) throw new Error(err);

  await config.initialize(); // 👈 forçage toujours utile pour éviter le crash
  await config.refreshAuth(authType);

  if (interactive || process.stdin.isTTY) {
    const question = prompt.trim() || config.getQuestion()?.trim();
    if (!question) throw new Error("Aucune question fournie.");
    const promptId = Math.random().toString(16).slice(2);
    console.log(`🤖 [INTERACTIF] Prompt: ${question}`);
    await runNonInteractive(config, question, promptId);
    return "Réponse interactive générée.";
  }

  const finalConfig = await applyNonInteractiveRestrictions(config, extensions, settings);
  const promptId = Math.random().toString(16).slice(2);

  try {
    await runNonInteractive(finalConfig, prompt, promptId);
    return "Réponse non-interactive générée.";
  } catch (error) {
    throw new Error(`Échec de génération Gemini : ${error}`);
  }
}

async function applyNonInteractiveRestrictions(
  config: Config,
  extensions: Extension[],
  settings: ReturnType<typeof loadSettings>
): Promise<Config> {
  const { ApprovalMode, ShellTool, EditTool, WriteFileTool } = await import('@google/gemini-cli-core');

  if (config.getApprovalMode() !== ApprovalMode.YOLO) {
    const newExcludeTools = [
      ...(settings.merged.excludeTools || []),
      ShellTool.Name,
      EditTool.Name,
      WriteFileTool.Name,
    ];

    const merged = {
      ...settings.merged,
      excludeTools: Array.from(new Set(newExcludeTools)),
    };

    const defaultCliArgs: import('../config/config.js').CliArgs = {
      model: settings.merged.model || 'gemini-1.5-flash',
      sandbox: false,
      sandboxImage: undefined,
      debug: false,
      prompt: '',
      promptInteractive: '',
      allFiles: false,
      all_files: false,
      extensions: [],
      allowedMcpServerNames: [],
      yolo: true,
      showMemoryUsage: false,
      show_memory_usage: false,
      telemetry: false,
      telemetryTarget: undefined,
      telemetryOtlpEndpoint: undefined,
      telemetryLogPrompts: undefined,
      checkpointing: false,
      proxy: undefined,
      experimentalAcp: false,
      listExtensions: false,
      ideMode: false,
    };

    const restrictedConfig = await loadCliConfig(merged, extensions, config.getSessionId(), defaultCliArgs);
    await restrictedConfig.initialize();
    return restrictedConfig;
  }

  await config.initialize(); // 👈 forcer init même en YOLO
  return config;
}
