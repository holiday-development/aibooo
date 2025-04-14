import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { getVersion } from '@tauri-apps/api/app';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // バージョン情報を取得
    getVersion()
      .then((version) => {
        console.log('Tauriバージョン:', version);
      })
      .catch(console.error);

    // アプリ起動時にグローバルショートカットを登録
    const registerShortcut = async () => {
      try {
        // Control+N ショートカットを登録
        await register('Control+N', () => {
          console.log('ショートカットが押されました: Control+N');
          setStatusMessage('ショートカットが押されました: Control+N');
          // Rustバックエンドの関数を呼び出す必要はありません
          // Rustバックエンドのグローバルショートカットが処理を行います

          // テストのために明示的にprocess_clipboardを呼び出してみる
          testProcessClipboard();
        });

        console.log('Control+N ショートカットを登録しました');
        setStatusMessage('Control+N ショートカットを登録しました');
      } catch (error) {
        console.error('ショートカット登録エラー:', error);
        setStatusMessage(`ショートカット登録エラー: ${error}`);
      }
    };

    registerShortcut();

    // クリーンアップ関数
    return () => {
      // アプリ終了時にすべてのショートカットを解除
      unregisterAll().catch(console.error);
    };
  }, []);

  // テスト用：明示的にprocess_clipboardを呼び出す
  async function testProcessClipboard() {
    try {
      setStatusMessage('process_clipboard関数を呼び出します...');

      // まずクリップボードの内容を確認
      const currentClipboardText = await readText();
      console.log('現在のクリップボード内容:', currentClipboardText);

      // Rustのprocess_clipboard関数を呼び出す
      await invoke('process_clipboard');
      setStatusMessage('process_clipboard関数が成功しました');

      // 成功したら、最新のクリップボードの内容を取得して表示
      const clipboardText = await readText();
      console.log('処理後のクリップボード内容:', clipboardText);
      setOutputText(clipboardText || '');
    } catch (error) {
      console.error('process_clipboard呼び出しエラー:', error);
      setStatusMessage(`process_clipboard呼び出しエラー: ${error}`);
    }
  }

  async function improveText() {
    try {
      setStatusMessage('テキスト変換中...');

      // テキストを改善
      const improved = await invoke<string>('improve_text', {
        text: inputText,
      });

      setStatusMessage('テキスト変換完了');

      // 結果を表示
      setOutputText(improved);

      // 改善されたテキストをクリップボードにコピー
      await writeText(improved);
      setStatusMessage('テキスト変換完了＆クリップボードにコピーしました');
    } catch (error) {
      console.error(error);
      setStatusMessage(`テキスト変換エラー: ${error}`);
    }
  }

  // クリップボードからテキストを読み込む
  async function pasteFromClipboard() {
    try {
      setStatusMessage('クリップボードから読み込み中...');
      const text = await readText();
      if (text) {
        setInputText(text);
        setStatusMessage(
          `クリップボードからテキストを読み込みました (${text.length} 文字)`
        );
      } else {
        setStatusMessage('クリップボードが空か、テキストが含まれていません');
      }
    } catch (error) {
      console.error('クリップボード読み取りエラー:', error);
      setStatusMessage(`クリップボード読み取りエラー: ${error}`);
    }
  }

  return (
    <div className="container">
      <h1>Write Better</h1>
      <p>メール文章を改善するツール</p>

      <div className="status-message">
        {statusMessage && <p>{statusMessage}</p>}
      </div>

      <div className="row">
        <div>
          <h2>元の文章</h2>
          <div className="textarea-container">
            <textarea
              id="input-text"
              onChange={(e) => setInputText(e.target.value)}
              value={inputText}
              rows={10}
              placeholder="ここに文章を入力してください"
            />
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="paste-button"
            >
              貼り付け
            </button>
          </div>
        </div>

        <div className="buttons">
          <button type="button" onClick={improveText}>
            変換 →
          </button>
          <button
            type="button"
            onClick={testProcessClipboard}
            className="test-button"
          >
            ショートカットテスト
          </button>
        </div>

        <div>
          <h2>改善された文章</h2>
          <textarea
            id="output-text"
            value={outputText}
            rows={10}
            readOnly
            placeholder="ここに改善された文章が表示されます"
          />
        </div>
      </div>

      <p className="instruction">
        <b>使い方：</b> テキストを選択してから <kbd>Command+Shift+I</kbd>
        を押すと選択中のテキストが自動的に改善されます。
        <br />
        改善された文章は自動的にクリップボードにコピーされます。
      </p>
    </div>
  );
}

export default App;
