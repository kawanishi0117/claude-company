import * as fs from 'fs';
import * as path from 'path';

describe('Documentation Localization', () => {
  const rootDir = path.join(__dirname, '../../');
  
  describe('Japanese Documentation Files', () => {
    test('README.ja.md should exist', () => {
      const filePath = path.join(rootDir, 'README.ja.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('CLAUDE.ja.md should exist', () => {
      const filePath = path.join(rootDir, 'CLAUDE.ja.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('docs/SETUP.ja.md should exist', () => {
      const filePath = path.join(rootDir, 'docs/SETUP.ja.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('docs/TROUBLESHOOTING.ja.md should exist', () => {
      const filePath = path.join(rootDir, 'docs/TROUBLESHOOTING.ja.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Language Selection Links', () => {
    test('README.md should contain language selection', () => {
      const filePath = path.join(rootDir, 'README.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('言語選択 / Language Selection');
      expect(content).toContain('[日本語](README.ja.md)');
    });

    test('CLAUDE.md should contain language selection', () => {
      const filePath = path.join(rootDir, 'CLAUDE.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('言語選択 / Language Selection');
      expect(content).toContain('[日本語](CLAUDE.ja.md)');
    });

    test('docs/SETUP.md should contain language selection', () => {
      const filePath = path.join(rootDir, 'docs/SETUP.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('言語選択 / Language Selection');
      expect(content).toContain('[日本語](SETUP.ja.md)');
    });

    test('docs/TROUBLESHOOTING.md should contain language selection', () => {
      const filePath = path.join(rootDir, 'docs/TROUBLESHOOTING.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('言語選択 / Language Selection');
      expect(content).toContain('[日本語](TROUBLESHOOTING.ja.md)');
    });
  });

  describe('Japanese Documentation Content', () => {
    test('README.ja.md should contain Japanese content', () => {
      const filePath = path.join(rootDir, 'README.ja.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('階層型AI開発システム');
      expect(content).toContain('クイックスタート');
      expect(content).toContain('前提条件');
    });

    test('CLAUDE.ja.md should contain Japanese content', () => {
      const filePath = path.join(rootDir, 'CLAUDE.ja.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('プロジェクト概要');
      expect(content).toContain('開発コマンド');
      expect(content).toContain('アーキテクチャ概要');
    });

    test('docs/SETUP.ja.md should contain Japanese content', () => {
      const filePath = path.join(rootDir, 'docs/SETUP.ja.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('セットアップガイド');
      expect(content).toContain('前提条件');
      expect(content).toContain('システム要件');
    });

    test('docs/TROUBLESHOOTING.ja.md should contain Japanese content', () => {
      const filePath = path.join(rootDir, 'docs/TROUBLESHOOTING.ja.md');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('トラブルシューティングガイド');
      expect(content).toContain('システム診断');
      expect(content).toContain('起動時の問題');
    });
  });

  describe('Cross-references and Links', () => {
    test('Japanese documentation should have proper cross-references', () => {
      const setupJaPath = path.join(rootDir, 'docs/SETUP.ja.md');
      const setupJaContent = fs.readFileSync(setupJaPath, 'utf8');
      
      // Check for references to other Japanese documentation
      expect(setupJaContent).toContain('[トラブルシューティング](#トラブルシューティング)');
    });

    test('All Japanese files should have language selection at the bottom', () => {
      const files = [
        'README.ja.md',
        'CLAUDE.ja.md',
        'docs/SETUP.ja.md',
        'docs/TROUBLESHOOTING.ja.md'
      ];

      files.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('言語選択 / Language Selection');
        expect(content).toContain('← 現在のページ');
      });
    });
  });
});