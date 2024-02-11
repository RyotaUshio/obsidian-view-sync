import { EditableFileView, Plugin, TFile, View, WorkspaceLeaf, normalizePath } from 'obsidian';
import { ViewSyncSettings, DEFAULT_SETTINGS, ViewSyncSettingTab } from 'settings';


declare module 'obsidian' {
	interface App {
		loadLocalStorage(key: string): string | null;
		// - If the second argument is not provided, it will remove the key from the local storage.
		// - `value` can be anything that can be serialized to JSON, but be careful that values
		//   that become false when casted to boolean will cause the key being removed from the local storage.
		saveLocalStorage(key: string, value?: any): void;
	}

	interface Workspace {
		on(name: string, callback: (...args: any[]) => any, ctx?: any): EventRef;
		on(name: 'view-sync:state-change', callback: (view: View, override?: { state?: any, eState?: any }) => any, ctx?: any): EventRef;
	}

	interface WorkspaceLeaf {
		isVisible(): boolean;
	}
}

export default class MyPlugin extends Plugin {
	settings: ViewSyncSettings;

	onload() {
		this.loadSettings();
		this.saveSettings();
		this.addSettingTab(new ViewSyncSettingTab(this));

		this.registerViewSyncEventPublisher();
		this.registerViewSyncEventSubscriber();

		this.registerWorkspaceSyncEventPublisher();
		this.registerWorkspaceSyncEventSubscriber();

		this.registerFileRenameHandler();
	}

	get loadStrorageKey() {
		return this.manifest.id + '-settings';
	}

	loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.app.loadLocalStorage(this.loadStrorageKey));
	}

	saveSettings() {
		this.app.saveLocalStorage(this.loadStrorageKey, this.settings);
	}

	async onViewStateChange(view: View, override?: { state?: any, eState?: any }) {
		const path = normalizePath(this.settings.ownPath);
		if (!path) return;

		if (this.settings.viewTypes.contains(view.getViewType())) {
			const leaf = view.leaf;
			if (leaf !== this.app.workspace.activeLeaf) return;

			const serialized = JSON.stringify(Object.assign(leaf.getViewState(), override));
			await this.writeFile(path, serialized);
		}
	}

	onWorkspaceLayoutChange() {
		const path = normalizePath(this.settings.ownWorkspacePath);
		if (!path) return;

		const layout = this.app.workspace.getLayout();
		const serialized = JSON.stringify(layout);
		this.writeFile(path, serialized);
	}

	registerViewSyncEventPublisher() {
		this.registerEvent(this.app.workspace.on('view-sync:state-change', (view, override) => {
			this.onViewStateChange(view, override);
			this.onWorkspaceLayoutChange();
		}));

		this.registerEvent(this.app.workspace.on('active-leaf-change', async (leaf) => {
			if (leaf) await this.onViewStateChange(leaf.view);
		}));
	}

	registerViewSyncEventSubscriber() {
		this.registerEvent(this.app.vault.on('modify', async (file) => {
			if (this.settings.watchAnotherWorkspace) return;

			if (this.settings.watchAnother && file instanceof TFile && normalizePath(this.settings.watchPath) === file.path) {
				const leaf = this.getSubscriberLeaf();
				if (!leaf) return;

				const data = await this.app.vault.read(file);
				const viewState = JSON.parse(data);

				await leaf.setViewState(viewState);
				if ('eState' in viewState) {
					leaf.view.setEphemeralState(viewState.eState);
				}
			}
		}));
	}

	getSubscriberLeaf() {
		let leaf: WorkspaceLeaf | null = null;

		const activeLeaf = this.app.workspace.activeLeaf;

		if (activeLeaf && activeLeaf.getRoot() === this.app.workspace.rootSplit) {
			leaf = activeLeaf;
		} else {
			this.app.workspace.iterateRootLeaves((l) => {
				if (!leaf && l.isVisible())
					leaf = l;
			});
		}

		return leaf;
	}

	registerWorkspaceSyncEventPublisher() {
		this.registerEvent(this.app.workspace.on('layout-change', this.onWorkspaceLayoutChange, this));
	}

	registerWorkspaceSyncEventSubscriber() {
		this.registerEvent(this.app.vault.on('modify', async (file) => {
			if (this.settings.watchAnotherWorkspace && file instanceof TFile && normalizePath(this.settings.watchWorkspacePath) === file.path) {
				const data = await this.app.vault.read(file);
				const layout = JSON.parse(data);
				this.app.workspace.changeLayout(layout);
			}
		}));
	}

	async writeFile(normalizedPath: string, data: string) {
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (file instanceof TFile) {
			await this.app.vault.modify(file, data);
			return;
		} else if (file === null) {
			const folderPath = normalizePath(normalizedPath.split('/').slice(0, -1).join('/'));
			if (folderPath) {
				const folderExists = !!(this.app.vault.getAbstractFileByPath(folderPath));
				if (!folderExists) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			if (normalizedPath) {
				return await this.app.vault.create(normalizedPath, data);
			}
		}
	}

	registerFileRenameHandler() {
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (oldPath === normalizePath(this.settings.ownPath)) {
				this.settings.ownPath = file.path;
				this.saveSettings();
			}
		}));
	}
}
