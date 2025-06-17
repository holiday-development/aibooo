import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';
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
const GENERATION_LIMIT = 300;

type ConvertType =
  | 'translate'
  | 'revision'
  | 'summarize'
  | 'formalize'
  | 'heartful';

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const isOverflow = inputText.length > MAX_LENGTH;
  const isDisabledConvertTextButton = isOverflow || inputText.length === 0;
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertType, setConvertType] = useState<ConvertType>('translate');

  useEffect(() => {
    const unlisten = listen('clipboard-processed', (event: any) => {
      // TODO: Clident側でClipboardの内容を取得して、それをセットする
      const originalText = event.payload as string;
      setInputText(originalText);
      setIsProcessing(true);
      invoke<string>('convert_text', { text: originalText })
        .then(setOutputText)
        .catch((error) => {
          let type = '';
          let message = '';
          if (typeof error === 'string') {
            try {
              const errObj = JSON.parse(error);
              type = errObj.type;
              message = errObj.message;
            } catch {
              // fallback: errorがJSONでなければそのまま
              message = error;
            }
          }
          if (type === 'limit_exceeded') {
            toast.error(error.message);
          } else if (message) {
            toast.error(message);
          } else {
            toast.error('テキスト変換に失敗しました');
          }
        })
        .finally(() => setIsProcessing(false));
    });

    return () => {
      unregisterAll().catch(console.error);
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  async function convertText() {
    try {
      setIsProcessing(true);
      const converted = await invoke<string>('convert_text', {
        text: inputText,
        type: convertType,
      });

      // 結果を表示
      setOutputText(converted);
    } catch (error) {
      let type = '';
      let message = '';
      if (typeof error === 'string') {
        try {
          const errObj = JSON.parse(error);
          type = errObj.type;
          message = errObj.message;
        } catch {
          message = error;
        }
      }
      if (type === 'limit_exceeded') {
        toast.error(`本日の利用回数上限（${GENERATION_LIMIT}回）に達しました`);
      } else if (message) {
        toast.error(message);
      } else {
        toast.error('テキスト変換に失敗しました');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex gap-5 h-screen p-6 w-full">
      <div className="flex flex-col gap-2 w-full">
        <Select
          value={convertType}
          onValueChange={(value) => setConvertType(value as ConvertType)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="校閲する" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="translate">翻訳する</SelectItem>
            <SelectItem value="revision">校閲する</SelectItem>
            <SelectItem value="summarize">まとめる</SelectItem>
            <SelectItem value="formalize">礼儀正しくする</SelectItem>
            <SelectItem value="heartful">優しくする</SelectItem>
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
          onClick={convertText}
          disabled={isDisabledConvertTextButton}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <RefreshCcw className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          {isProcessing ? '変換中...' : '変換する'}
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
