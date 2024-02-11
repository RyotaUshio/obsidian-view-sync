import { Component, IconName, MarkdownRenderer, Platform, PluginSettingTab, Setting, TFile, setIcon } from 'obsidian';
import MyPlugin from 'main';


export interface ViewSyncSettings {
	ownPath: string;
	viewTypes: string[];
	watchAnother: boolean;
	watchPath: string;
	shareAfterSync: boolean;
	ownWorkspacePath: string;
	watchAnotherWorkspace: boolean;
	watchWorkspacePath: string;
}

export const DEFAULT_SETTINGS: ViewSyncSettings = {
	ownPath: '',
	viewTypes: ['markdown', 'canvas', 'pdf'],
	watchAnother: false,
	watchPath: '',
	shareAfterSync: false,
	ownWorkspacePath: '',
	watchAnotherWorkspace: false,
	watchWorkspacePath: '',
};

// Inspired by https://stackoverflow.com/a/50851710/13613783
export type KeysOfType<Obj, Type> = NonNullable<{ [k in keyof Obj]: Obj[k] extends Type ? k : never }[keyof Obj]>;

export class ViewSyncSettingTab extends PluginSettingTab {
	component: Component;
	items: Partial<Record<keyof ViewSyncSettings, Setting>>;
	promises: Promise<any>[];

	constructor(public plugin: MyPlugin) {
		super(plugin.app, plugin);
		this.component = new Component();
		this.items = {};
		this.promises = [];
	}

	get settings(): ViewSyncSettings {
		return this.plugin.settings;
	}

	addSetting(settingName?: keyof ViewSyncSettings) {
		const item = new Setting(this.containerEl);
		if (settingName) this.items[settingName] = item;
		return item;
	}

	addHeading(heading: string, icon?: IconName) {
		return this.addSetting()
			.setName(heading)
			.setHeading()
			.then((setting) => {
				if (icon) {
					const iconEl = createDiv();
					setting.settingEl.prepend(iconEl)
					setIcon(iconEl, icon);
				}
			});
	}

	addPathSetting(settingName: KeysOfType<ViewSyncSettings, string>, placeholder?: string) {
		let newPath = this.settings[settingName];

		this.component.register(() => {
			const oldPath = this.settings[settingName];
			this.settings[settingName] = newPath;
			if (oldPath !== newPath) {
				this.plugin.saveSettings();
				const file = this.app.vault.getAbstractFileByPath(oldPath);
				if (file instanceof TFile) {
					this.app.fileManager.renameFile(file, newPath);
				}
			}
		});

		return this.addSetting(settingName)
			.addText((text) => {
				text.setValue(this.settings[settingName])
					.setPlaceholder(placeholder ?? '')
					.then((text) => {
						if (placeholder) {
							text.inputEl.size = Math.max(text.inputEl.size, text.inputEl.placeholder.length);
						}
					})
					.onChange((value) => {
						newPath = value;
					});
			});
	}

	addCSVSetting(settingName: KeysOfType<ViewSyncSettings, string[]>, placeholder?: string, onBlur?: () => any) {
		return this.addSetting(settingName)
			.addText((text) => {
				text.setValue(this.plugin.settings[settingName].join(', '))
					.setPlaceholder(placeholder ?? '')
					.then((text) => {
						if (placeholder) {
							text.inputEl.size = Math.max(text.inputEl.size, text.inputEl.placeholder.length);
						}
					})
					.onChange(async (value) => {
						this.plugin.settings[settingName] = value.split(',').map((s) => s.trim());
						this.plugin.saveSettings();
					});
				if (onBlur) this.component.registerDomEvent(text.inputEl, 'blur', onBlur);
			});
	}

	addToggleSetting(settingName: KeysOfType<ViewSyncSettings, boolean>, extraOnChange?: (value: boolean) => void) {
		return this.addSetting(settingName)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings[settingName])
					.onChange(async (value) => {
						// @ts-ignore
						this.plugin.settings[settingName] = value;
						await this.plugin.saveSettings();
						extraOnChange?.(value);
					});
			});
	}

	addDesc(desc: string) {
		return this.addSetting()
			.setDesc(desc);
	}

	addFundingButton() {
		return this.addHeading('Support development', 'lucide-heart')
			.setDesc(`If you find ${this.plugin.manifest.name} helpful, please consider supporting the development to help me keep this plugin alive.\n\nIf you prefer PayPal, please make donations via Ko-fi. Thank you!`)
			.then((setting) => {
				const infoEl = setting.infoEl;
				const iconEl = setting.settingEl.firstElementChild;
				if (!iconEl) return;

				const container = setting.settingEl.createDiv();
				container.appendChild(iconEl);
				container.appendChild(infoEl);
				setting.settingEl.prepend(container);

				setting.settingEl.id = `${this.plugin.manifest.id}-funding`;
				container.id = `${this.plugin.manifest.id}-funding-icon-info-container`;
				iconEl.id = `${this.plugin.manifest.id}-funding-icon`;
			})
			.addButton((button) => {
				button
					.setButtonText('GitHub Sponsors')
					.onClick(() => {
						open('https://github.com/sponsors/RyotaUshio');
					});
			})
			.addButton((button) => {
				button
					.setButtonText('Buy Me a Coffee')
					.onClick(() => {
						open('https://www.buymeacoffee.com/ryotaushio');
					});
			})
			.addButton((button) => {
				button
					.setButtonText('Ko-fi')
					.onClick(() => {
						open('https://ko-fi.com/ryotaushio');
					});
			});
	}

	async renderMarkdown(lines: string[] | string, el: HTMLElement) {
		this.promises.push(this._renderMarkdown(lines, el));
		el.addClass('markdown-rendered');
	}

	async _renderMarkdown(lines: string[] | string, el: HTMLElement) {
		await MarkdownRenderer.render(this.app, Array.isArray(lines) ? lines.join('\n') : lines, el, '', this.component);
		if (el.childNodes.length === 1 && el.firstChild instanceof HTMLParagraphElement) {
			el.replaceChildren(...el.firstChild.childNodes);
		}
	}

	/** Refresh the setting tab and then scroll back to the original position. */
	async redisplay() {
		const scrollTop = this.containerEl.scrollTop;
		this.display();
		this.containerEl.scroll({ top: scrollTop });
	}

	display() {
		this.component.unload();
		this.component.load();
		this.containerEl.empty();

		const exampleStr =
			Platform.isDesktop ? 'desktop'
				: Platform.isTablet ? 'tablet'
					: 'mobile';
		const exampleFollowedStr = Platform.isDesktop ? 'tablet' : 'desktop';

		this.addHeading('Active view sync', 'lucide-file-text');

		this.addPathSetting('ownPath', `view-sync-${exampleStr}.json`)
			.setName('File to track active view states for this device')
			.setDesc('Active view states will be tracked by this file. Required for other devices to follow this device\'s active view states. Each device should have a unique path to avoid conflicts. The extension can be anything.')
		this.addCSVSetting('viewTypes', 'ex) markdown, pdf, canvas')
			.setName('View types to watch');
		this.addToggleSetting('watchAnother', () => this.redisplay())
			.setName('Follow another device')
			.setDesc('Note: It might be problematic if you let two devices follow each other. I recommend a one-way sync: one main device and one or more follower devices.');

		if (this.settings.watchAnother) {
			this.addPathSetting('watchPath', `view-sync-${exampleFollowedStr}.json`)
				.setName('Path of the active view state file for the followed device');
			if (Platform.isMobileApp) {
				this.addToggleSetting('shareAfterSync')
					.setName('Show "Share" menu after sync')
					.setDesc('Useful for drawing on PDF files on tablet, for example.')
			}
		}

		this.addHeading('Workspace sync', 'lucide-layout');

		this.addPathSetting('ownWorkspacePath', `workspace-sync-${exampleStr}.json`)
			.setName('File to track workspace layout for this device')
			.setDesc('Workspace layouts will be tracked by this file. Required for other devices to follow this device\'s workspace layouts. Each device should have a unique path to avoid conflicts. The extension can be anything.');
		this.addToggleSetting('watchAnotherWorkspace', () => this.redisplay())
			.setName('Follow another device')
			.then((setting) => {
				this.renderMarkdown([
					'Note: ',
					'',
					'- It might be problematic if you let two devices follow each other. I recommend a one-way sync: one main device and one or more follower devices.',
					'- It is not recommended to make a mobile device follow a desktop device or vice versa.',
				], setting.descEl);
			});

		if (this.settings.watchAnotherWorkspace) {
			this.addPathSetting('watchWorkspacePath', `workspace-sync-${exampleFollowedStr}.json`)
				.setName('Path of the workspace layout file for the followed device');
		}

		this.addFundingButton();
	}

	hide() {
		this.component.unload();
	}
}
