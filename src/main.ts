import { FileView, Notice, Platform, Plugin, TFile, View, WorkspaceLeaf, normalizePath } from 'obsidian';
import { ViewSyncSettings, DEFAULT_SETTINGS, ViewSyncSettingTab } from 'settings';


declare module 'obsidian' {
	interface App {
		openWithDefaultApp(path: string): Promise<void>;
		loadLocalStorage(key: string): string | null;
		// - If the second argument is not provided, it will remove the key from the local storage.
		// - `value` can be anything that can be serialized to JSON, but be careful that values
		//   that become false when casted to boolean will cause the key being removed from the local storage.
		saveLocalStorage(key: string, value?: any): void;
	}

	interface Workspace {
		on(name: string, callback: (...args: any[]) => any, ctx?: any): EventRef;
		// Other plugins can trigger the `view-sync:state-change` event when the state of their custom view
		// changes but the change cannot be informed with the `active-leaf-change` event.
		// If `override` is provided, it can be used to manupulate the recorded view state.
		on(name: 'view-sync:state-change', callback: (view: View, override?: { state?: any, eState?: any }) => any, ctx?: any): EventRef;
	}

	interface WorkspaceLeaf {
		isVisible(): boolean;
	}
}

export default class ViewSyncPlugin extends Plugin {
	settings: ViewSyncSettings;
	#lastViewStateSave: number = 0;
	#lastWorkspaceLayoutSave: number = 0;

	onload() {
		this.loadSettings();
		this.saveSettings();
		this.addSettingTab(new ViewSyncSettingTab(this));

		this.registerViewSyncEventPublisher();
		this.registerViewSyncEventSubscriber();

		this.registerWorkspaceSyncEventPublisher();
		this.registerWorkspaceSyncEventSubscriber();

		this.registerFileRenameHandler();

		this.registerCommands();
	}

	get loadStrorageKey() {
		return this.manifest.id + '-settings';
	}

	// We use localStorage because this plugin's settings are device-specific.
	loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.app.loadLocalStorage(this.loadStrorageKey));
	}

	saveSettings() {
		this.app.saveLocalStorage(this.loadStrorageKey, this.settings);
	}

	/** Write the text `data` into the specified file. If the file does not exist, it will be created. */
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

	/** Record the state of the active view to the specified file. */
	async onViewStateChange(view: View, override?: { state?: any, eState?: any }) {
		const path = normalizePath(this.settings.ownPath);
		// An empty string is normalized to `/`
		if (path === '/') return;

		if (this.settings.viewTypes.contains(view.getViewType())) {
			const leaf = view.leaf;
			// Make sure that only the active leaf's state is recorded
			if (leaf !== this.app.workspace.activeLeaf) return;

			const timestamp = Date.now();
			this.#lastViewStateSave = timestamp;
			const serialized = JSON.stringify({
				timestamp,
				viewState: Object.assign(
					leaf.getViewState(),
					{ eState: view.getEphemeralState() }, // Ephemeral state is not included in the result of getViewState()
					override
				)
			});
			await this.writeFile(path, serialized);
		}
	}

	/** Record the workspace layout to the specified file. */
	async onWorkspaceLayoutChange() {
		const path = normalizePath(this.settings.ownWorkspacePath);
		// An empty string is normalized to `/`
		if (path === '/') return;

		const layout = this.app.workspace.getLayout();
		const timestamp = Date.now();
		this.#lastWorkspaceLayoutSave = timestamp;
		const serialized = JSON.stringify({ timestamp, layout });
		await this.writeFile(path, serialized);
	}

	registerViewSyncEventPublisher() {
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf) this.onViewStateChange(leaf.view);
		}));

		this.registerEvent(this.app.workspace.on('view-sync:state-change', (view, override) => {
			this.onViewStateChange(view, override);
			this.onWorkspaceLayoutChange();
		}));
	}

	registerViewSyncEventSubscriber() {
		this.registerEvent(this.app.vault.on('modify', async (file) => {
			if (this.settings.watchAnotherWorkspace) return;

			if (this.settings.watchAnother && file instanceof TFile && normalizePath(this.settings.watchPath) === file.path) {
				const leaf = this.getSubscriberLeaf();
				if (!leaf) return;

				const data = await this.app.vault.read(file);
				const { timestamp, viewState } = JSON.parse(data);

				if (this.settings.syncOnlyIfNewer && this.#lastViewStateSave >= timestamp) return;

				await leaf.setViewState(viewState);
				if ('eState' in viewState) {
					leaf.view.setEphemeralState(viewState.eState);
				}
				if (Platform.isMobileApp && this.settings.shareAfterSync && leaf.view instanceof FileView) {
					const file = leaf.view.file;
					if (file) this.app.openWithDefaultApp(file.path);
				}
			}
		}));
	}

	getSubscriberLeaf() {
		let leaf: WorkspaceLeaf | null = null;

		// I believe using `activeLeaf` is innevitable here.
		const activeLeaf = this.app.workspace.activeLeaf;

		// Avoid opening in sidebars
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
				const { timestamp, layout } = JSON.parse(data);

				if (this.settings.syncWorkspaceOnlyIfNewer && this.#lastWorkspaceLayoutSave >= timestamp) return;

				await this.app.workspace.changeLayout(layout);
			}
		}));
	}

	registerFileRenameHandler() {
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (oldPath === normalizePath(this.settings.ownPath)) {
				this.settings.ownPath = file.path;
				this.saveSettings();
			}
		}));
	}

	registerCommands() {
		this.addCommand({
			id: 'copy-view-type',
			name: 'Copy active view type',
			callback: () => {
				const leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					const type = leaf.view.getViewType();
					navigator.clipboard.writeText(type);
					new Notice(`${this.manifest.name}: View type "${type}" copied to clipboard.`);
					return;
				}
				new Notice(`${this.manifest.name}: There is no active view.`);
			}
		});
	}
}
