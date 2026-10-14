import { useRef, useState } from 'react';
import { ArrowDownToLine, HardDrive, ShieldCheck, Upload } from 'lucide-react';
import {
  createBackup,
  download,
  restoreBackup,
  validateBackup,
  type Backup,
} from '../engine/storage';
import { Modal } from '../components/Common';
export function Settings({
  candidate,
  setCandidate,
  onRestored,
}: {
  candidate: string;
  setCandidate: (v: string) => void;
  onRestored: () => Promise<void>;
}) {
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [backup, setBackup] = useState<Backup>(),
    [busy, setBusy] = useState(false),
    [storage, setStorage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function restoreFile(file?: File) {
    if (!file) return;
    setError('');
    try {
      if (file.size > 50_000_000) throw new Error('Backup exceeds the 50 MB restore limit.');
      setBackup(validateBackup(JSON.parse(await file.text())));
    } catch (e) {
      setError(`Backup rejected: ${e instanceof Error ? e.message : 'Invalid file.'}`);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LOCAL-FIRST, BY DESIGN</div>
          <h1>Settings & data</h1>
          <p>Your device is your examination centre. Keep a backup of what matters.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card p-4">
          <h2>
            <ShieldCheck size={22} /> Candidate preferences
          </h2>
          <p className="text-secondary">
            Used for new practice attempts. Existing attempts retain their original identity.
          </p>
          <label className="form-label">
            Practice candidate name
            <input
              className="form-control"
              maxLength={100}
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
            />
          </label>
          <hr />
          <h3>Privacy & local storage</h3>
          <p>
            Question banks, responses and results are stored in IndexedDB in this browser profile,
            on this device. No accounts, remote databases or analytics are used.
          </p>
          <p className="text-secondary">
            Clearing browser data, private-browsing sessions, or automatic browser eviction can
            remove these records. A downloaded backup is the only way to move completed history
            between devices.
          </p>
          <button
            className="btn btn-outline-secondary"
            onClick={async () => {
              try {
                if (!navigator.storage?.persist) {
                  setStorage(
                    'Persistent storage requests are not supported here. Download backups regularly.',
                  );
                  return;
                }
                const granted = await navigator.storage.persist();
                const estimate = await navigator.storage.estimate();
                setStorage(
                  `${granted ? 'Persistent storage granted.' : 'The browser did not grant persistent storage. Keep regular backups.'} Usage: ${Math.round((estimate.usage ?? 0) / 1024)} KB.`,
                );
              } catch {
                setStorage('Could not request persistent storage. Download a backup.');
              }
            }}
          >
            <HardDrive size={16} /> Request persistent storage
          </button>
          {storage && (
            <p className="small mt-3" role="status">
              {storage}
            </p>
          )}
        </section>
        <section className="card p-4">
          <h2>Backup & restore</h2>
          <p className="text-secondary">
            Export your entire exam library and attempt snapshots in a versioned JSON backup.
          </p>
          <button
            className="btn btn-primary mb-3"
            onClick={async () => {
              try {
                download(
                  `examdesk-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  await createBackup(),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <ArrowDownToLine size={17} /> Download full backup
          </button>
          <hr />
          <h3>Restore a backup</h3>
          <p>
            Every record is validated before import. Existing record IDs are skipped, never
            overwritten. Completed scores are recalculated from their original snapshots. Active
            attempts are skipped to avoid reviving live examinations.
          </p>
          <button className="btn btn-outline-secondary" onClick={() => input.current?.click()}>
            <Upload size={16} /> Choose backup file
          </button>
          <input
            type="file"
            ref={input}
            hidden
            accept=".json"
            aria-label="Restore backup JSON"
            onChange={(e) => void restoreFile(e.target.files?.[0])}
          />
          <hr />
          <h3>Offline access</h3>
          <p>
            Open the production app once while online and allow its static assets to cache. You can
            then reopen it offline. Keep the same browser and URL. Development mode does not install
            an offline service worker.
          </p>
          <p className="small text-secondary">
            Updates wait for a fresh application session rather than interrupting an active
            examination.
          </p>
        </section>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger mt-4">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="alert alert-success mt-4">
          {notice}
        </div>
      )}
      {backup && (
        <Modal
          title="Restore this backup?"
          onClose={() => setBackup(undefined)}
          footer={
            <>
              <button className="btn btn-outline-secondary" onClick={() => setBackup(undefined)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await restoreBackup(backup);
                    setNotice(
                      `${result.added} records restored; ${result.skipped} existing or active records skipped.`,
                    );
                    setBackup(undefined);
                    await onRestored();
                  } catch (e) {
                    setError((e as Error).message);
                    setBackup(undefined);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Restoring…' : 'Restore records'}
              </button>
            </>
          }
        >
          <p>
            This backup contains {backup.exams.length} examinations and{' '}
            {backup.attempts.filter((a) => a.status === 'completed').length} completed attempts.
          </p>
          <p>
            It will be merged into this browser’s library without replacing existing IDs. Active
            attempts will not be restored.
          </p>
        </Modal>
      )}
    </>
  );
}
