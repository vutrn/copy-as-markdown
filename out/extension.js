const vscode = require('vscode');
const path = require('path');

const CODE_EXTENSIONS = new Set([
  'js','jsx','ts','tsx','mjs','cjs','json','jsonc','html','htm','css','scss','sass','less',
  'md','mdx','txt','xml','svg','py','pyw','java','kt','kts','c','h','cc','cpp','cxx','hpp',
  'cs','go','rs','rb','php','swift','dart','lua','r','sh','bash','zsh','fish','ps1','bat','cmd',
  'sql','graphql','gql','vue','svelte','astro','yaml','yml','toml','ini','conf','gradle','properties'
]);
const SPECIAL_CODE_NAMES = new Set([
  'Dockerfile','Makefile','Jenkinsfile','Procfile','.gitignore','.gitattributes',
  '.editorconfig','.prettierrc','.eslintrc'
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
  constructor(file, checked) {
    super(path.basename(file.uri.fsPath), vscode.TreeItemCollapsibleState.None);
    this.file = file;
    this.contextValue = 'codeFile';
    this.resourceUri = file.uri;
    const p = file.relativePath.replace(/\\/g, '/');
    const i = p.lastIndexOf('/');
    this.description = i >= 0 ? p.slice(0, i) : undefined;
    this.tooltip = p;
    this.checkboxState = checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    this.command = { command: 'vscode.open', title: 'Open File', arguments: [file.uri] };
  }
}

class FolderTreeItem extends vscode.TreeItem {
  constructor(folder) {
    super(path.basename(folder.uri.fsPath), vscode.TreeItemCollapsibleState.Collapsed);
    this.folder = folder;
    this.contextValue = 'codeFolder';
    this.resourceUri = folder.uri;
    this.tooltip = folder.relativePath;
  }
}

class Provider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.files = [];
    this.selected = new Set();
    this.rootUri = undefined;
    this.selectAllNode = new ControlNode();
    void this.load();
  }

  async load() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    this.rootUri = folder?.uri;
    if (!folder) {
      this.files = [];
      this.selected.clear();
      this.updateSelectAll();
      return;
    }

    const exclude = vscode.workspace.getConfiguration('copyAsMarkdown').get('exclude')
      || '**/{node_modules,.git,.svn,.hg,dist,build,out}/**';
    const uris = await vscode.workspace.findFiles('**/*', exclude);
    const result = [];

    for (const uri of uris) {
      if (!this.isCodeFile(uri)) continue;
      result.push({ kind: 'file', uri, relativePath: vscode.workspace.asRelativePath(uri, false) });
    }

    result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const valid = new Set(result.map(x => x.uri.toString()));
    for (const key of [...this.selected]) {
      if (!valid.has(key)) this.selected.delete(key);
    }
    this.files = result;
    this.updateSelectAll();
  }

  async refresh() {
    await this.load();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    if (element instanceof vscode.TreeItem) return element;
    if (element.kind === 'file') {
      return new FileTreeItem(element, this.selected.has(element.uri.toString()));
    }
    return new FolderTreeItem(element);
  }

  getChildren(element) {
    if (!element) {
      if (!this.rootUri) return [new vscode.TreeItem('Open a folder or workspace first.')];
      return [this.selectAllNode, ...this.sort([
        ...this.getFolders(''),
        ...this.getFiles('')
      ])];
    }
    if (element instanceof ControlNode) return [];
    if (element.kind === 'file') return [];
    return this.sort([
      ...this.getFolders(element.relativePath),
      ...this.getFiles(element.relativePath)
    ]);
  }

  setChecked(item, state) {
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
    this._onDidChangeTreeData.fire();
  }

  selectAll() {
    for (const file of this.files) this.selected.add(file.uri.toString());
    this.updateSelectAll();
    this._onDidChangeTreeData.fire();
  }

  clearSelection() {
    this.selected.clear();
    this.updateSelectAll();
    this._onDidChangeTreeData.fire();
  }

  getSelectedFiles() {
    return this.files.filter(file => this.selected.has(file.uri.toString()));
  }

  updateSelectAll() {
    if (!this.files.length || !this.selected.size) {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    } else if (this.selected.size === this.files.length) {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Checked;
    } else {
      this.selectAllNode.checkboxState = vscode.TreeItemCheckboxState.Indeterminate;
    }
  }

  isCodeFile(uri) {
    const name = path.basename(uri.fsPath);
    if (SPECIAL_CODE_NAMES.has(name)) return true;
    return CODE_EXTENSIONS.has(path.extname(name).slice(1).toLowerCase());
  }

  getFiles(parent) {
    return this.files.filter(file => path.dirname(file.relativePath).replace(/\\/g, '/') === parent);
  }

  getFolders(parent) {
    const prefix = parent ? parent + '/' : '';
    const names = new Set();
    for (const file of this.files) {
      const p = file.relativePath.replace(/\\/g, '/');
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash >= 0) names.add(prefix + rest.slice(0, slash));
    }
    return [...names].map(relativePath => ({
      kind: 'folder',
      relativePath,
      uri: vscode.Uri.joinPath(this.rootUri, ...relativePath.split('/'))
    }));
  }

  sort(items) {
    return items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }
}

function languageFromPath(relativePath) {
  const base = path.basename(relativePath).toLowerCase();
  const ext = path.extname(base).slice(1);
  const map = {
    js:'javascript',jsx:'jsx',ts:'typescript',tsx:'tsx',mjs:'javascript',cjs:'javascript',
    json:'json',jsonc:'jsonc',html:'html',htm:'html',css:'css',scss:'scss',sass:'sass',less:'less',
    md:'markdown',mdx:'mdx',py:'python',pyw:'python',java:'java',kt:'kotlin',kts:'kotlin',
    c:'c',h:'c',cc:'cpp',cpp:'cpp',cxx:'cpp',hpp:'cpp',cs:'csharp',go:'go',rs:'rust',rb:'ruby',
    php:'php',swift:'swift',dart:'dart',lua:'lua',r:'r',sh:'bash',bash:'bash',zsh:'zsh',fish:'fish',
    ps1:'powershell',bat:'bat',cmd:'bat',sql:'sql',graphql:'graphql',gql:'graphql',vue:'vue',
    svelte:'svelte',astro:'astro',yaml:'yaml',yml:'yaml',toml:'toml',xml:'xml',svg:'xml',gradle:'gradle',
    properties:'properties'
  };
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[ext] || '';
}

async function copySelected(provider) {
  const files = provider.getSelectedFiles();
  if (!files.length) {
    void vscode.window.showInformationMessage('Select at least one code file first.');
    return;
  }

  const config = vscode.workspace.getConfiguration('copyAsMarkdown');
  const includePath = config.get('includeFilePath', true);
  const includeLanguage = config.get('includeLanguage', true);
  const parts = [];

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

function activate(context) {
  const provider = new Provider();
  const tree = vscode.window.createTreeView('copyAsMarkdown.files', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(tree);
  context.subscriptions.push(
    tree.onDidChangeCheckboxState(event => {
      for (const [item, state] of event.items) provider.setChecked(item, state);
    }),
    vscode.commands.registerCommand('copyAsMarkdown.copySelected', () => copySelected(provider)),
    vscode.commands.registerCommand('copyAsMarkdown.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('copyAsMarkdown.clearSelection', () => provider.clearSelection()),
    vscode.commands.registerCommand('copyAsMarkdown.selectAll', () => provider.selectAll()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh())
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  const refresh = () => provider.refresh();
  context.subscriptions.push(watcher, watcher.onDidCreate(refresh), watcher.onDidDelete(refresh));
}

function deactivate() {}
module.exports = { activate, deactivate };
