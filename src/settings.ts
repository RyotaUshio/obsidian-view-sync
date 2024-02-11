import { AbstractInputSuggest, Component, IconName, MarkdownRenderer, PluginSettingTab, SearchResultContainer, Setting, TFile, prepareFuzzySearch, renderResults, setIcon, setTooltip, sortSearchResults } from 'obsidian';
import MyPlugin from 'main';


export interface ViewSyncSettings {
	ownPath: string;
	viewTypes: string[];
	watchAnother: boolean;
	watchPath: string;
	ownWorkspacePath: string;
	watchAnotherWorkspace: boolean;
	watchWorkspacePath: string;
}

export const DEFAULT_SETTINGS: ViewSyncSettings = {
	ownPath: '',
	viewTypes: ['pdf'],
	watchAnother: false,
	watchPath: '',
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

	scrollTo(settingName: keyof ViewSyncSettings) {
		this.items[settingName]?.settingEl.scrollIntoView();
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

	// addTextAreaSetting(settingName: KeysOfType<ViewSyncSettings, string>, placeholder?: string, onBlur?: () => any) {
	// 	return this.addSetting(settingName)
	// 		.addTextArea((text) => {
	// 			text.setValue(this.plugin.settings[settingName])
	// 				.setPlaceholder(placeholder ?? '')
	// 				.onChange(async (value) => {
	// 					// @ts-ignore
	// 					this.plugin.settings[settingName] = value;
	// 					await this.plugin.saveSettings();
	// 				});
	// 			if (onBlur) this.component.registerDomEvent(text.inputEl, 'blur', onBlur);
	// 		});
	// }

	// addNumberSetting(settingName: KeysOfType<ViewSyncSettings, number>) {
	// 	return this.addSetting(settingName)
	// 		.addText((text) => {
	// 			text.setValue('' + this.plugin.settings[settingName])
	// 				.setPlaceholder('' + DEFAULT_SETTINGS[settingName])
	// 				.then((text) => text.inputEl.type = 'number')
	// 				.onChange(async (value) => {
	// 					// @ts-ignore
	// 					this.plugin.settings[settingName] = value === '' ? DEFAULT_SETTINGS[settingName] : +value;
	// 					await this.plugin.saveSettings();
	// 				});
	// 		});
	// }

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

	// addColorPickerSetting(settingName: KeysOfType<ViewSyncSettings, HexString>, extraOnChange?: (value: HexString) => void) {
	// 	return this.addSetting(settingName)
	// 		.addColorPicker((picker) => {
	// 			picker.setValue(this.plugin.settings[settingName])
	// 				.onChange(async (value) => {
	// 					// @ts-ignore
	// 					this.plugin.settings[settingName] = value;
	// 					await this.plugin.saveSettings();
	// 					extraOnChange?.(value);
	// 				});
	// 		});
	// }

	// addDropdownSetting(settingName: KeysOfType<ViewSyncSettings, string>, options: readonly string[], display?: (option: string) => string, extraOnChange?: (value: string) => void): Setting;
	// addDropdownSetting(settingName: KeysOfType<ViewSyncSettings, string>, options: Record<string, string>, extraOnChange?: (value: string) => void): Setting;
	// addDropdownSetting(settingName: KeysOfType<ViewSyncSettings, string>, ...args: any[]) {
	// 	let options: string[] = [];
	// 	let display = (optionValue: string) => optionValue;
	// 	let extraOnChange = (value: string) => { };
	// 	if (Array.isArray(args[0])) {
	// 		options = args[0];
	// 		if (typeof args[1] === 'function') display = args[1];
	// 		if (typeof args[2] === 'function') extraOnChange = args[2];
	// 	} else {
	// 		options = Object.keys(args[0]);
	// 		display = (optionValue: string) => args[0][optionValue];
	// 		if (typeof args[1] === 'function') extraOnChange = args[1];
	// 	}
	// 	return this.addSetting(settingName)
	// 		.addDropdown((dropdown) => {
	// 			for (const option of options) {
	// 				const displayName = display(option) ?? option;
	// 				dropdown.addOption(option, displayName);
	// 			}
	// 			dropdown.setValue(this.plugin.settings[settingName])
	// 				.onChange(async (value) => {
	// 					// @ts-ignore
	// 					this.plugin.settings[settingName] = value;
	// 					await this.plugin.saveSettings();
	// 					extraOnChange?.(value);
	// 				});
	// 		});
	// }

	// addIndexDropdownSetting(settingName: KeysOfType<ViewSyncSettings, number>, options: readonly string[], display?: (option: string) => string, extraOnChange?: (value: number) => void): Setting {
	// 	return this.addSetting(settingName)
	// 		.addDropdown((dropdown) => {
	// 			for (const option of options) {
	// 				const displayName = display?.(option) ?? option;
	// 				dropdown.addOption(option, displayName);
	// 			}
	// 			const index = this.plugin.settings[settingName];
	// 			const option = options[index];
	// 			dropdown.setValue(option)
	// 				.onChange(async (value) => {
	// 					const newIndex = options.indexOf(value);
	// 					if (newIndex !== -1) {
	// 						// @ts-ignore
	// 						this.plugin.settings[settingName] = newIndex;
	// 						await this.plugin.saveSettings();
	// 						extraOnChange?.(newIndex);
	// 					}
	// 				});
	// 		});
	// }

	// addSliderSetting(settingName: KeysOfType<ViewSyncSettings, number>, min: number, max: number, step: number) {
	// 	return this.addSetting(settingName)
	// 		.addSlider((slider) => {
	// 			slider.setLimits(min, max, step)
	// 				.setValue(this.plugin.settings[settingName])
	// 				.setDynamicTooltip()
	// 				.onChange(async (value) => {
	// 					// @ts-ignore
	// 					this.plugin.settings[settingName] = value;
	// 					await this.plugin.saveSettings();
	// 				});
	// 		});
	// }

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

	// addNameValuePairListSetting<Item>(items: Item[], index: number, defaultIndexKey: KeysOfType<ViewSyncSettings, number>, accesors: {
	// 	getName: (item: Item) => string,
	// 	setName: (item: Item, value: string) => void,
	// 	getValue: (item: Item) => string,
	// 	setValue: (item: Item, value: string) => void,
	// }, configs: {
	// 	name: {
	// 		placeholder: string,
	// 		formSize: number,
	// 		duplicateMessage: string,
	// 	},
	// 	value: {
	// 		placeholder: string,
	// 		formSize: number,
	// 		formRows?: number, // for multi-line value
	// 	},
	// 	delete: {
	// 		deleteLastMessage: string,
	// 	}
	// }) {
	// 	const { getName, setName, getValue, setValue } = accesors;
	// 	const item = items[index];
	// 	const name = getName(item);
	// 	const value = getValue(item);

	// 	return this.addSetting()
	// 		.addText((text) => {
	// 			text.setPlaceholder(configs.name.placeholder)
	// 				.then((text) => {
	// 					text.inputEl.size = configs.name.formSize;
	// 					setTooltip(text.inputEl, configs.name.placeholder);
	// 				})
	// 				.setValue(name)
	// 				.onChange(async (newName) => {
	// 					if (items.some((item) => getName(item) === newName)) {
	// 						new Notice(configs.name.duplicateMessage);
	// 						text.inputEl.addClass('error');
	// 						return;
	// 					}
	// 					text.inputEl.removeClass('error');
	// 					setName(item, newName);

	// 					const setting = this.items[defaultIndexKey];
	// 					if (setting) {
	// 						const optionEl = ((setting as Setting).components[0] as DropdownComponent).selectEl.querySelector<HTMLOptionElement>(`:scope > option:nth-child(${index + 1})`);
	// 						if (optionEl) {
	// 							optionEl.value = newName;
	// 							optionEl.textContent = newName;
	// 						}
	// 					}

	// 					await this.plugin.saveSettings();
	// 				});
	// 		})
	// 		.then((setting) => {
	// 			if (configs.value.hasOwnProperty('formRows')) {
	// 				setting.addTextArea((textarea) => {
	// 					textarea.setPlaceholder(configs.value.placeholder)
	// 						.then((textarea) => {
	// 							textarea.inputEl.rows = configs.value.formRows!;
	// 							textarea.inputEl.cols = configs.value.formSize;
	// 							setTooltip(textarea.inputEl, configs.value.placeholder);
	// 						})
	// 						.setValue(value)
	// 						.onChange(async (newValue) => {
	// 							setValue(item, newValue);
	// 							await this.plugin.saveSettings();
	// 						});
	// 				});
	// 			} else {
	// 				setting.addText((textarea) => {
	// 					textarea.setPlaceholder(configs.value.placeholder)
	// 						.then((text) => {
	// 							text.inputEl.size = configs.value.formSize;
	// 							setTooltip(text.inputEl, configs.value.placeholder);
	// 						})
	// 						.setValue(value)
	// 						.onChange(async (newValue) => {
	// 							setValue(item, newValue);
	// 							await this.plugin.saveSettings();
	// 						});
	// 				})
	// 			}
	// 		})
	// 		.addExtraButton((button) => {
	// 			button.setIcon('trash')
	// 				.setTooltip('Delete')
	// 				.onClick(async () => {
	// 					if (items.length === 1) {
	// 						new Notice(configs.delete.deleteLastMessage);
	// 						return;
	// 					}
	// 					items.splice(index, 1);
	// 					if (this.plugin.settings[defaultIndexKey] >= index) {
	// 						this.plugin.settings[defaultIndexKey]--;
	// 					}
	// 					await this.plugin.saveSettings();
	// 					this.redisplay();
	// 				});
	// 		})
	// 		.setClass('no-border');
	// }

	addHotkeySettingButton(setting: Setting) {
		setting.addButton((button) => {
			button.setButtonText('Open hotkeys settings')
				.onClick(() => {
					// @ts-ignore
					const tab = this.app.setting.openTabById('hotkeys');
					tab.setQuery(this.plugin.manifest.id);
				});
		});
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

		this.addHeading('View sync', 'lucide-file-text');

		this.addPathSetting('ownPath', 'view-sync.json')
			.setName('Own path');
		this.addCSVSetting('viewTypes', 'ex) markdown, pdf, canvas')
			.setName('View types to watch');
		this.addToggleSetting('watchAnother', () => this.redisplay())
			.setName('Follow another device');

		if (this.settings.watchAnother) {
			this.addPathSetting('watchPath')
				.setName('File path to watch');
		}

		this.addHeading('Workspace sync', 'lucide-layout');

		this.addPathSetting('ownWorkspacePath', 'workspace-sync.json')
			.setName('Own path');
		this.addToggleSetting('watchAnotherWorkspace', () => this.redisplay())
			.setName('Follow another device');

		if (this.settings.watchAnotherWorkspace) {
			this.addPathSetting('watchWorkspacePath')
				.setName('File path to watch');
		}

		this.addFundingButton();
	}

	hide() {
		this.component.unload();
	}
}


type Ranked<Item> = SearchResultContainer & { item: Item };

abstract class FuzzyInputSuggest<Item> extends AbstractInputSuggest<Ranked<Item>> {
	plugin: MyPlugin;
	inputEl: HTMLInputElement;

	constructor(plugin: MyPlugin, inputEl: HTMLInputElement) {
		super(plugin.app, inputEl);
		this.inputEl = inputEl;
		this.plugin = plugin;
	}

	abstract getItems(): Item[];

	abstract getItemText(item: Item): string;

	abstract getName(item: Item): string;

	getSuggestions(query: string) {
		const search = prepareFuzzySearch(query.trim());
		const items = this.getItems();

		const results: Ranked<Item>[] = [];

		for (const item of items) {
			const target = this.getItemText(item);
			const match = search(target);
			if (match) results.push({ match, item });
		}

		sortSearchResults(results);

		return results;
	}

	renderSuggestion(rankedItem: Ranked<Item>, el: HTMLElement) {
		const { item, match } = rankedItem;
		renderResults(el, this.getItemText(item), match);
	}

	selectSuggestion(rankedItem: Ranked<Item>) {
		const { item } = rankedItem;

		this.inputEl.blur();
		this.inputEl.value = this.getName(item);
		this.close();
	}
}
