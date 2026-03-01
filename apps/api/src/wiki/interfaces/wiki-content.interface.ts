export interface SubsystemWikiContent {
  groupId: string;
  name: string;
  overview: string;
  howItWorks: string;
  publicInterfaces: InterfaceDoc[];
  citations: Citation[];
  dependencies: string[];
  keyFiles: string[];
}

export interface Citation {
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
}

export interface InterfaceDoc {
  name: string;
  type: 'function' | 'class' | 'endpoint' | 'component' | 'hook' | 'export';
  signature: string;
  description: string;
  filePath: string;
  lineStart: number;
}
