"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserAvatar } from "./user-avatar";
import { Button } from "@/components/ui/button";
import { setAvatar, removeAvatar } from "@/lib/auth/avatar-actions";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Avatar with change/remove. The three-step upload (docs/file-upload-contract.md):
 *   1. ask the backend to sign a presigned storage PUT (`{signUrl}/sign`),
 *   2. PUT the file DIRECTLY to Supabase Storage (bytes never touch our servers),
 *   3. persist the resulting URL via a server action (which re-validates it).
 * `signUrl` (the `FILE_UPLOAD_URL` env, e.g. "/api/files") is null when uploads
 * aren't configured — then only the avatar renders, no controls.
 */
export function AvatarUpload({
  locale: _locale,
  name,
  avatarUrl,
  signUrl,
}: {
  locale: string;
  name: string;
  avatarUrl: string | null;
  signUrl: string | null;
}) {
  const t = useTranslations("account");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) return toast.error(t("avatarBadType"));
    if (file.size > MAX_BYTES) return toast.error(t("avatarTooBig"));
    setBusy(true);
    try {
      // 1. Presign. Map the backend's typed failures to a specific message so a
      // misconfigured deployment says WHICH thing is wrong, not just "try again".
      const signRes = await fetch(`${signUrl}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "avatar", contentType: file.type, size: file.size }),
      });
      if (!signRes.ok) {
        // 503 = storage env not configured; 401/403 = session/permission.
        if (signRes.status === 503) return toast.error(t("avatarNotConfigured"));
        if (signRes.status === 401 || signRes.status === 403)
          return toast.error(t("avatarForbidden"));
        return toast.error(t("avatarError"));
      }
      const { uploadUrl, contentType, key, publicUrl } = await signRes.json();

      // 2. Upload straight to Supabase Storage (raw PUT; Content-Type must match
      // the type signed into the URL, else the signature check rejects it). A
      // thrown fetch here is typically a CORS/network wall between the browser
      // and the storage bucket.
      let up: Response;
      try {
        up = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
      } catch {
        // A thrown fetch here is a CORS/network wall to the storage bucket.
        return toast.error(t("avatarUploadFailed"));
      }
      if (!up.ok) return toast.error(t("avatarUploadFailed"));

      // 3. Persist (server re-validates the URL against the storage base + prefix).
      // "invalid" means the object uploaded but the persisted URL didn't match the
      // configured public base — usually a SUPABASE_PUBLIC_BASE_URL mismatch.
      const result = await setAvatar(key, publicUrl);
      if (result.error) {
        return toast.error(result.error === "invalid" ? t("avatarSaveFailed") : t("avatarForbidden"));
      }
      toast.success(t("avatarUpdated"));
      router.refresh();
    } catch {
      toast.error(t("avatarError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={name} src={avatarUrl} className="size-12 text-lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{name}</p>
        {signUrl && (
          <div className="mt-1 flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}>
              {busy ? t("avatarUploading") : t("avatarChange")}
            </Button>
            {avatarUrl && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    await removeAvatar();
                    router.refresh();
                    setBusy(false);
                  })()
                }>
                {t("avatarRemove")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
