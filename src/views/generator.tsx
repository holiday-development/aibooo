import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCcw } from 'lucide-react';
import { ClipboardTextarea } from '../components/ui/clipboard-textarea';
import { MaxLengthTextarea } from '@/components/ui/max-length-textarea';
import { toast } from 'sonner';
import { load } from '@tauri-apps/plugin-store';
import { useScreenType } from '@/contexts/use-screen-type';

const MAX_LENGTH = 5000;

type ConvertType =
  | 'translate'
  | 'revision'
  | 'summarize'
  | 'formalize'
  | 'heartful';

export function Generator() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const isOverflow = inputText.length > MAX_LENGTH;
  const isDisabledConvertTextButton = isOverflow || inputText.length === 0;
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertType, setConvertType] = useState<ConvertType>('translate');
  const { switchScreenType } = useScreenType();

  async function loadConvertTypeStore() {
    const store = await load('usage.json');
    const convertType = store.get('convert_type');
    return convertType;
  }

  async function onConvertTypeChange(value: ConvertType) {
    setConvertType(value);
    const store = await load('usage.json');
    store.set('convert_type', value);
    store.save();
  }

  useEffect(() => {
    loadConvertTypeStore().then((convertType) => {
      setConvertType(convertType as ConvertType);
    });
  }, []);

  useEffect(() => {
    const unlisten = listen('clipboard-processed', async (event: any) => {
      const originalText = event.payload as string;
      setInputText(originalText);
      setIsProcessing(true);
      const convertTypeFromStore = await loadConvertTypeStore();
      invoke<string>('convert_text', {
        text: originalText,
        type: convertTypeFromStore,
      })
        .then(setOutputText)
        .catch((error) => {
          const errObj = JSON.parse(error as string);
          if (errObj.type === 'limit_exceeded') {
            switchScreenType('LIMIT_EXCEEDED');
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
      setOutputText(converted);
    } catch (error) {
      const errObj = JSON.parse(error as string);
      if (errObj.type === 'limit_exceeded') {
        switchScreenType('LIMIT_EXCEEDED');
      } else {
        toast.error('テキスト変換に失敗しました');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        <Select value={convertType} onValueChange={onConvertTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="校閲する" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="translate">翻訳する</SelectItem>
            <SelectItem value="revision">校閲する</SelectItem>
            <SelectItem value="summarize">まとめる</SelectItem>
            <SelectItem value="formalize">礼儀正しくする</SelectItem>
            <SelectItem value="heartful">優しくする</SelectItem>
            <SelectItem value="spark">独創的にする</SelectItem>
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
    </>
  );
}
