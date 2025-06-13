import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCcw } from "lucide-react";
import { ClipboardTextarea } from "./components/ui/clipboard-textarea";

function App() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // バージョン情報を取得
    getVersion()
      .then((version) => {
        console.log("Tauriバージョン:", version);
      })
      .catch(console.error);

    // バックエンドからのイベントをリッスン
    const unlisten = listen("clipboard-processed", (event: any) => {
      console.log("clipboard-processedイベント受信:", event);

      const [originalText, improvedText] = event.payload as [string, string];

      // 元のテキストを「元の文章」に表示
      setInputText(originalText);

      // 改善されたテキストを「改善された文章」に表示
      setOutputText(improvedText);

      setStatusMessage("テキストが変換されました");
    });

    // アプリ起動時にグローバルショートカットを登録
    const registerShortcut = async () => {
      try {
        // Control+N ショートカットを登録
        await register("Control+N", () => {
          console.log("ショートカットが押されました: Control+N");
          setStatusMessage("ショートカットが押されました: Control+N");
          // Rustバックエンドのショートカットハンドラが処理を行い、
          // イベントで結果が返ってくるのでここでは何もしません
        });

        console.log("Control+N ショートカットを登録しました");
        setStatusMessage("Control+N ショートカットを登録しました");
      } catch (error) {
        console.error("ショートカット登録エラー:", error);
        setStatusMessage(`ショートカット登録エラー: ${error}`);
      }
    };

    registerShortcut();

    // クリーンアップ関数
    return () => {
      // アプリ終了時にショートカットとイベントリスナーを解除
      unregisterAll().catch(console.error);
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  // テスト用：明示的にprocess_clipboardを呼び出す
  async function testProcessClipboard() {
    try {
      setStatusMessage("process_clipboard関数を呼び出します...");

      // まずクリップボードの内容を確認
      const currentClipboardText = await readText();
      console.log("現在のクリップボード内容:", currentClipboardText);

      // Rustのprocess_clipboard関数を呼び出す
      const [originalText, improvedText] = await invoke<[string, string]>(
        "process_clipboard"
      );

      // 元のテキストと改善されたテキストを表示
      setInputText(originalText);
      setOutputText(improvedText);

      setStatusMessage("process_clipboard関数が成功しました");
    } catch (error) {
      console.error("process_clipboard呼び出しエラー:", error);
      setStatusMessage(`process_clipboard呼び出しエラー: ${error}`);
    }
  }

  async function improveText() {
    try {
      setStatusMessage("テキスト変換中...");

      // テキストを改善
      const improved = await invoke<string>("improve_text", {
        text: inputText,
      });

      // 結果を表示
      setOutputText(improved);
      // サイズを変更
      setStatusMessage("テキスト変換完了");
    } catch (error) {
      console.error(error);
      setStatusMessage(`テキスト変換エラー: ${error}`);
    }
  }

  // クリップボードからテキストを読み込む
  async function pasteFromClipboard() {
    try {
      setStatusMessage("クリップボードから読み込み中...");
      const text = await readText();
      if (text) {
        setInputText(text);
        setStatusMessage(
          `クリップボードからテキストを読み込みました (${text.length} 文字)`
        );
      } else {
        setStatusMessage("クリップボードが空か、テキストが含まれていません");
      }
    } catch (error) {
      console.error("クリップボード読み取りエラー:", error);
      setStatusMessage(`クリップボード読み取りエラー: ${error}`);
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
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="お疲れ様です。先日の件について、ご確認いただけますでしょうか。"
          className="flex-1 resize-none"
        />
      </div>
      <div className="flex flex-col gap-2 w-full items-start">
        <Button
          variant="ghost"
          onClick={improveText}
          disabled={inputText.length === 0}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="size-4" />
          Regenerate
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
