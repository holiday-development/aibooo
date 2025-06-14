import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { listen } from '@tauri-apps/api/event';
import './index.css';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCcw } from 'lucide-react';
import { ClipboardTextarea } from './components/ui/clipboard-textarea';
import { MaxLengthTextarea } from '@/components/ui/max-length-textarea';
import { toast } from 'sonner';

const MAX_LENGTH = 5000;

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [globalErrorMessage, setGlobalErrorMessage] = useState('');
  const isOverflow = inputText.length > MAX_LENGTH;
  const isDisabledImproveTextButton = isOverflow || inputText.length === 0;

  useEffect(() => {
    if (globalErrorMessage) {
      toast.error(globalErrorMessage);
    }
  }, [globalErrorMessage]);

  useEffect(() => {
    const unlisten = listen('clipboard-processed', (event: any) => {
      const [originalText, improvedText] = event.payload as [string, string];
      setInputText(originalText);
      setOutputText(improvedText);
    });

    const registerShortcut = async () => {
      await register('Control+N', () => {});
    };

    registerShortcut();

    return () => {
      unregisterAll().catch(console.error);
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  // テスト用：明示的にprocess_clipboardを呼び出す
  async function testProcessClipboard() {
    try {
      // まずクリップボードの内容を確認
      const currentClipboardText = await readText();
      console.log('現在のクリップボード内容:', currentClipboardText);

      // Rustのprocess_clipboard関数を呼び出す
      const [originalText, improvedText] =
        await invoke<[string, string]>('process_clipboard');

      // 元のテキストと改善されたテキストを表示
      setInputText(originalText);
      setOutputText(improvedText);
    } catch (error) {
      console.error('process_clipboard呼び出しエラー:', error);
    }
  }

  async function improveText() {
    try {
      // テキストを改善
      const improved = await invoke<string>('improve_text', {
        text: inputText,
      });

      // 結果を表示
      setOutputText(improved);
    } catch (error) {
      console.error(error);
    }
  }

  // クリップボードからテキストを読み込む
  async function pasteFromClipboard() {
    try {
      const text = await readText();
      if (text) {
        setInputText(text);
      } else {
        setGlobalErrorMessage(
          'クリップボードが空か、テキストが含まれていません'
        );
      }
    } catch (error) {
      console.error('クリップボード読み取りエラー:', error);
      setGlobalErrorMessage(`クリップボード読み取りエラー: ${error}`);
    }
  }

  return (
    <div className="flex gap-5 h-screen p-6 w-full">
      <div className="flex flex-col gap-2 w-full">
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue defaultValue="kousei" placeholder="校正する" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kousei">校正する</SelectItem>
            <SelectItem value="summarize">要約する</SelectItem>
            <SelectItem value="translate">翻訳する</SelectItem>
            <SelectItem value="soften">優しくする</SelectItem>
          </SelectContent>
        </Select>
        <MaxLengthTextarea
          maxLength={MAX_LENGTH}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="お疲れ様です。先日の件について、ご確認いただけますでしょうか。"
          className="flex-1 resize-none h-full"
        />
      </div>
      <div className="flex flex-col gap-2 w-full items-start">
        <Button
          variant="ghost"
          onClick={improveText}
          disabled={isDisabledImproveTextButton}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="size-4" />
          変換する
        </Button>
        <ClipboardTextarea
          copyable={true}
          value={outputText}
          readOnly
          className="flex-1 resize-none h-full"
        />
      </div>
    </div>
  );
}

export default App;
