import * as path from 'path';
import * as vscode from 'vscode';

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'jsonc', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'md', 'mdx', 'txt', 'xml', 'svg', 'py', 'pyw', 'java', 'kt', 'kts', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp',
  'cs', 'go', 'rs', 'rb', 'php', 'swift', 'dart', 'lua', 'r', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'sql', 'graphql', 'gql', 'vue', 'svelte', 'astro', 'yaml', 'yml', 'toml', 'ini', 'conf', 'gradle', 'properties'
]);

const SPECIAL_CODE_NAMES = new Set([
  'Dockerfile', 'Makefile', 'Jenkinsfile', 'Procfile', '.gitignore', '.gitattributes',
  '.editorconfig', '.prettierrc', '.eslintrc'
]);

class ControlNode extends vscode.TreeItem {
  constructor() {
    super('Select all files');
    this.contextValue = 'control';
    this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    this.tooltip = 'Select or clear every visible code file';
  }
}

class FileTreeItem extends vscode.TreeItem {
  file: any;

  constructor(file: any, checked: boolean) {
    super(path.basename(file.uri.fsPath), vscode.TreeItemCollapsibleState.None);
    this.file = file;
    this.contextValue = 'codeFile';
    this.resourceUri = file.uri;
    const p = file.relativePath.replace(/\\/g, '/');
    const i = p.lastIndexOf('/');
    this.description = i >= 0 ? p.slice(0, i) : undefined;
    this.tooltip = p;
    this.checkboxState = checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    this.command = { command: 'vscode.open', title: 'Open File', arguments: [file.uri] };
  }
}

class FolderTreeItem extends vscode.TreeItem {
  folder: any;

  constructor(folder: any) {
    super(path.basename(folder.uri.fsPath), vscode.TreeItemCollapsibleState.Collapsed);
    this.folder = folder;
    this.contextValue = 'codeFolder';
    this.resourceUri = folder.uri;
    this.tooltip = folder.relativePath;
  }
}

class Provider implements vscode.TreeDataProvider<any> {
  private _onDidChangeTreeData = new vscode.EventEmitter<any | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: any[] = [];
  private selected = new Set<string>();
  private rootUri: vscode.Uri | undefined;
  private readonly selectAllNode = new ControlNode();

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    this.rootUri = folder?.uri;

    if (!folder) {
      this.files = [];
      this.selected.clear();
      this.updateSelectAll();
      return;
    }

    const exclude = vscode.workspace.getConfiguration('copyAsMarkdown').get<string>('exclude', '**/{node_modules,.git,.svn,.hg,dist,build,out}/**');

    const uris = await vscode.workspace.findFiles('**/*', exclude);
    const result: any[] = [];

    for (const uri of uris) {
      if (!this.isCodeFile(uri)) continue;
      result.push({
        kind: 'file',
        uri,
        relativePath: vscode.workspace.asRelativePath(uri, false)
      });
    }

    result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const valid = new Set(result.map((x) => x.uri.toString()));
    for (const key of [...this.selected]) {
      if (!valid.has(key)) this.selected.delete(key);
    }

    this.files = result;
    this.updateSelectAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  getTreeItem(element: any): vscode.TreeItem {
    if (element instanceof vscode.TreeItem) return element;
    if (element.kind === 'file') {
      return new FileTreeItem(element, this.selected.has(element.uri.toString()));
    }
    return new FolderTreeItem(element);
  }

  getChildren(element?: any): Thenable<any[]> {
    if (!element) {
      if (!this.rootUri) {
        return Promise.resolve([new vscode.TreeItem('Open a folder or workspace first.')]);
      }
      return Promise.resolve([this.selectAllNode, ...this.sort([
        ...this.getFolders(''),
        ...this.getFiles('')
      ])]);
    }

    if (element instanceof ControlNode) return Promise.resolve([]);
    if (element.kind === 'file') return Promise.resolve([]);

    return Promise.resolve(this.sort([
      ...this.getFolders(element.relativePath),
      ...this.getFiles(element.relativePath)
    ]));
  }

  setChecked(item: any, state: vscode.TreeItemCheckboxState): void {
    if (item instanceof ControlNode) {
      if (state === vscode.TreeItemCheckboxState.Checked) {
        for (const file of this.files) this.selected.add(file.uri.toString());
      } else {
        this.selected.clear();
      }
    } else if (item && item.file) {
      const key = item.file.uri.toString();
      if (state === vscode.TreeItemCheckboxState.Checked) this.selected.add(key);
      else this.selected.delete(key);
    }

    this.updateSelectAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  toggleChecked(item: any): void {
    if (item instanceof ControlNode) {
      if (this.selected.size === this.files.length) {
        this.clearSelection();
      } else {
        this.selectAll();
      }
      return;
    }

    if (!item || !item.file) return;

    const key = item.file.uri.toString();
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);

    this.updateSelectAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  selectAll(): void {
    for (const file of this.files) this.selected.add(file.uri.toString());
    this.updateSelectAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  clearSelection(): void {
    this.selected.clear();
    this.updateSelectAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  getSelectedFiles(): any[] {
    return this.files.filter((file) => this.selected.has(file.uri.toString()));
  }

  private updateSelectAll(): void {
    if (!this.files.length || !this.selected.size) {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    } else if (this.selected.size === this.files.length) {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Checked;
    } else {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    }
  }

  private isCodeFile(uri: vscode.Uri): boolean {
    const name = path.basename(uri.fsPath);
    if (SPECIAL_CODE_NAMES.has(name)) return true;
    return CODE_EXTENSIONS.has(path.extname(name).slice(1).toLowerCase());
  }

  private getFiles(parent: string): any[] {
    return this.files.filter((file) => path.dirname(file.relativePath).replace(/\\/g, '/') === parent);
  }

  private getFolders(parent: string): any[] {
    const prefix = parent ? parent + '/' : '';
    const names = new Set<string>();

    for (const file of this.files) {
      const p = file.relativePath.replace(/\\/g, '/');
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash >= 0) names.add(prefix + rest.slice(0, slash));
    }

    return [...names].map((relativePath) => ({
      kind: 'folder',
      relativePath,
      uri: vscode.Uri.joinPath(this.rootUri!, ...relativePath.split('/'))
    }));
  }

  private sort(items: any[]): any[] {
    return items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }
}

function languageFromPath(relativePath: string): string {
  const base = path.basename(relativePath).toLowerCase();
  const ext = path.extname(base).slice(1);
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', mjs: 'javascript', cjs: 'javascript',
    json: 'json', jsonc: 'jsonc', html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    md: 'markdown', mdx: 'mdx', py: 'python', pyw: 'python', java: 'java', kt: 'kotlin', kts: 'kotlin',
    c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby',
    php: 'php', swift: 'swift', dart: 'dart', lua: 'lua', r: 'r', sh: 'bash', bash: 'bash', zsh: 'zsh', fish: 'fish',
    ps1: 'powershell', bat: 'bat', cmd: 'bat', sql: 'sql', graphql: 'graphql', gql: 'graphql', vue: 'vue',
    svelte: 'svelte', astro: 'astro', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', svg: 'xml', gradle: 'gradle',
    properties: 'properties'
  };

  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[ext] || '';
}

async function copySelected(provider: Provider): Promise<void> {
  const files = provider.getSelectedFiles();
  if (!files.length) {
    void vscode.window.showInformationMessage('Select at least one code file first.');
    return;
  }

  const config = vscode.workspace.getConfiguration('copyAsMarkdown');
  const includePath = config.get('includeFilePath', true);
  const includeLanguage = config.get('includeLanguage', true);
  const parts: string[] = [];

  for (const file of files) {
    try {
      const bytes = await vscode.workspace.fs.readFile(file.uri);
      const content = new TextDecoder('utf-8').decode(bytes).replace(/\s+$/, '');
      const language = includeLanguage ? languageFromPath(file.relativePath) : '';
      const fence = '```' + language;
      const heading = includePath ? `### ${file.relativePath}\n\n` : '';
      parts.push(heading + fence + '\n' + content + '\n```');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parts.push(`### ${file.relativePath}\n\n> Could not read this file: ${message}`);
    }
  }

  await vscode.env.clipboard.writeText(parts.join('\n\n'));
  void vscode.window.showInformationMessage(`Copied ${files.length} file${files.length === 1 ? '' : 's'} as Markdown.`);
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new Provider();
  const tree = vscode.window.createTreeView('copyAsMarkdown.files', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(tree);
  context.subscriptions.push(
    tree.onDidChangeCheckboxState((event) => {
      for (const entry of event.items) {
        const item = (Array.isArray(entry) ? entry[0] : entry) as any;
        provider.toggleChecked(item);
      }
    }),
    vscode.commands.registerCommand('copyAsMarkdown.copySelected', () => copySelected(provider)),
    vscode.commands.registerCommand('copyAsMarkdown.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('copyAsMarkdown.clearSelection', () => provider.clearSelection()),
    vscode.commands.registerCommand('copyAsMarkdown.selectAll', () => provider.selectAll()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh())
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  const refresh = () => void provider.refresh();
  context.subscriptions.push(watcher, watcher.onDidCreate(refresh), watcher.onDidDelete(refresh));
}

export function deactivate(): void {
  // no-op
}
