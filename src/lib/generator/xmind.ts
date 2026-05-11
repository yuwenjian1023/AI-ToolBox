import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

// ===== Types =====

interface MindmapNode {
  title: string;
  children: MindmapNode[];
}

interface XMindTopic {
  id: string;
  title: string;
  class?: string;
  structureClass?: string;
  children?: {
    attached: XMindTopic[];
  };
  extensions?: unknown[];
}

// ===== Parse Mermaid mindmap to tree =====

export function parseMermaidMindmap(code: string): MindmapNode {
  const lines = code.split('\n');
  const root: MindmapNode = { title: 'Mind Map', children: [] };
  const stack: { node: MindmapNode; indent: number }[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    // Skip empty lines and the "mindmap" declaration
    if (!trimmed || trimmed === 'mindmap') continue;

    // Detect indentation level (count leading spaces)
    const indent = rawLine.search(/\S/);

    // Extract title: remove root((..)), ((..)), (..), {..}, [..] markers
    let title = trimmed;
    // root((text))
    const rootMatch = title.match(/^root\(\((.+?)\)\)$/);
    if (rootMatch) {
      root.title = rootMatch[1];
      stack.length = 0;
      stack.push({ node: root, indent });
      continue;
    }
    // ((text)) - round
    const roundMatch = title.match(/^\(\((.+?)\)\)$/);
    if (roundMatch) title = roundMatch[1];
    // (text) - rounded rect
    const parenMatch = title.match(/^\((.+?)\)$/);
    if (parenMatch) title = parenMatch[1];
    // [text] - square
    const bracketMatch = title.match(/^\[(.+?)\]$/);
    if (bracketMatch) title = bracketMatch[1];
    // {text} - diamond
    const braceMatch = title.match(/^\{(.+?)\}$/);
    if (braceMatch) title = braceMatch[1];
    // ::icon(...) - strip icons
    title = title.replace(/::icon\(.+?\)/g, '').trim();

    const newNode: MindmapNode = { title, children: [] };

    // Find parent: walk back the stack to find a node with smaller indent
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      // This is the root level
      root.title = title;
      stack.push({ node: root, indent });
    } else {
      const parent = stack[stack.length - 1].node;
      parent.children.push(newNode);
      stack.push({ node: newNode, indent });
    }
  }

  return root;
}

// ===== Build XMind topic tree =====

function nodeToXMindTopic(node: MindmapNode, isRoot = false): XMindTopic {
  const topic: XMindTopic = {
    id: randomUUID().replace(/-/g, '').slice(0, 26),
    title: node.title,
  };

  if (isRoot) {
    topic.class = 'topic';
    topic.structureClass = 'org.xmind.ui.map.clockwise';
  }

  if (node.children.length > 0) {
    topic.children = {
      attached: node.children.map((child) => nodeToXMindTopic(child)),
    };
  }

  return topic;
}

// ===== Color theme (matches the XMind screenshot style) =====

function getTheme() {
  return {
    id: randomUUID(),
    centralTopic: {
      id: randomUUID(),
      properties: {
        'svg:fill': 'none',
        'line-color': '#141414',
        'fo:color': '#3949AB',
        'shape-class': 'org.xmind.topicShape.roundedRect',
        'border-line-width': '4',
        'line-class': 'org.xmind.branchConnection.roundedfold',
        'line-width': '3pt',
        'fill-style': 'solid',
        'fo:font-family': 'Roboto',
        'fo:font-style': 'normal',
        'fo:font-weight': 700,
        'fo:font-size': '30pt',
      },
    },
    mainTopic: {
      id: randomUUID(),
      properties: {
        'svg:fill': 'none',
        'fo:color': '#141414',
        'shape-class': 'org.xmind.topicShape.underline',
        'border-line-width': '3',
        'line-class': 'org.xmind.branchConnection.bight',
        'line-width': '2pt',
        'fill-style': 'solid',
        'fo:font-family': 'Roboto',
        'fo:font-style': 'normal',
        'fo:font-weight': '500',
        'fo:font-size': '18pt',
      },
    },
    subTopic: {
      id: randomUUID(),
      properties: {
        'svg:fill': 'none',
        'fo:color': '#141414',
        'shape-class': 'org.xmind.topicShape.underline',
        'line-class': 'org.xmind.branchConnection.bight',
        'fill-style': 'solid',
        'fo:font-family': 'Roboto',
        'fo:font-style': 'normal',
        'fo:font-weight': 400,
        'fo:font-size': '14pt',
      },
    },
    map: {
      id: randomUUID(),
      properties: {
        'svg:fill': '#ffffff',
        'line-tapered': 'tapered',
      },
    },
  };
}

// ===== Generate .xmind file =====

export async function generateXMindFile(
  mermaidCode: string,
  taskTitle: string,
  taskId: string
): Promise<string> {
  const tree = parseMermaidMindmap(mermaidCode);
  const rootTopic = nodeToXMindTopic(tree, true);
  const sheetId = randomUUID().replace(/-/g, '').slice(0, 26);

  const contentJson = [
    {
      id: sheetId,
      class: 'sheet',
      title: taskTitle,
      rootTopic: rootTopic,
      theme: getTheme(),
      topicPositioning: 'fixed',
    },
  ];

  const metadataJson = {
    creator: {
      name: 'audio-to-markdown',
      version: '1.0.0',
    },
    activeSheetId: sheetId,
  };

  const manifestJson = {
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
    },
  };

  // Create ZIP
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify(contentJson));
  zip.file('metadata.json', JSON.stringify(metadataJson));
  zip.file('manifest.json', JSON.stringify(manifestJson));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  // Save file
  const sanitized = taskTitle
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_${sanitized}_${taskId}.xmind`;
  const outputPath = path.resolve(OUTPUT_DIR, filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);

  return outputPath;
}
