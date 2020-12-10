
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	CodeActionKind
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import * as electronegativity from '@doyensec/electronegativity' ;
import * as path from 'path';
import * as remediation from './remediation-advice.json';
import * as os from 'os';


// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. 
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let resultsFile = "-electron-results.json";
let remediationIssues: Object;

connection.onInitialize((params: InitializeParams) => {

	// read the custom remediation advice for Electronegativity issues
	remediationIssues = remediation.issues;
	console.log(remediationIssues);

	// read the capabilities for the server
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,			
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.electrolintLanguageServer || defaultSettings)
		);
	}

	// Revalidate all open JavaScript documents	
	documents.all().forEach(runElectronegativity);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'electrolintLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// On document "save" action run the analysis
documents.onDidSave(change => {
	runElectronegativity(change.document);
});

async function runElectronegativity(textDocument: TextDocument): Promise<void> {

	let decodedDocumentUri = decodeURIComponent(textDocument.uri);
	// remove "file://" for macOSx and windows
	// if OS is Windows, remove extra forward slash
	let currentPlatform = os.platform();
	if (currentPlatform == 'win32') {
		decodedDocumentUri = decodedDocumentUri.replace(/^file?:\/\/\//,'');
	} else {//'linux', 'darwin'
		decodedDocumentUri = decodedDocumentUri.replace(/^file?:\/\//,'');
	}

	let documentPath = path.dirname(decodedDocumentUri);
	let resultsFileName = path.basename(decodedDocumentUri, path.extname(decodedDocumentUri));
	let outputFilePath = path.resolve(documentPath, resultsFileName + resultsFile);

	electronegativity({	
		input: decodedDocumentUri,
		// save the results to a file in csv or sarif format (optional)
		output: outputFilePath,
		// true to save output as sarif, false to save as csv (optional)
		isSarif: false,
		// only run the specified checks (optional)
		customScan: [],
		})
		.then(result => {
			console.log(JSON.stringify(result));
			let diagnostics: Diagnostic[] = [];
			
			result.issues.forEach(issue => {
				if (issue.file != "N/A" && issue.sample) {
					let diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: { line: issue.location.line - 1, character: issue.location.column },
							end : { line: issue.location.line - 1, character : issue.location.column + issue.sample.length }
						   },						
						message: issue.id,
						source: issue.description
					};

					diagnostic.relatedInformation = [
						{
							location: {
								uri: textDocument.uri,
								range: Object.assign({}, diagnostic.range)
							},
							message: `${remediationIssues[issue.id] ? "Remediation: "+remediationIssues[issue.id] : ""}`
						},
					];

					diagnostics.push(diagnostic);
				}				
			});
			
			// Send the computed diagnostics to VSCode.
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		})
		.catch(err => console.error(err));
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The passed parameter contains the position of the text document in
		// which code complete got requested. 
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
