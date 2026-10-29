
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  shop_name: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  delivery_info: string;
  logo_url: string;
};

type UploadAuth = {
  cloudName: string;
  apiKey: string;
  timestamp: string | number;
  folder: string;
  signature: string;
  error?: string;
};

const defaults: Settings = {
  shop_name: "YOUR STORE",
  tagline: "STYLE · SCENT · EVERYDAY",
  description: "Explore fragrances, fashion, accessories and everyday essentials.",
  phone: "",
  whatsapp: "",
  delivery_info: "",
  logo_url: "",
};

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

export default function AdminSettingsPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const auth = await fetch("/api/admin/me", {
          credentials: "same-origin",
        });

        if (!auth.ok) {
          router.replace("/admin/login");
          return;
        }

        const response = await fetch("/api/admin/settings", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load settings.");
        }

        setForm({ ...defaults, ...data });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreview("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setLocalPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function update(field: keyof Settings, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseLogo(file?: File) {
    setError("");
    setMessage("");

    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Choose a PNG, JPG or WebP image.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setError("Your logo must be 5 MB or smaller.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setSelectedFile(file);
    setRemoveLogo(false);
  }

  async function uploadLogo(): Promise<string> {
    if (!selectedFile) return form.logo_url;

    const authResponse = await fetch("/api/admin/uploads/sign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "logo" }),
    });


    const auth = (await authResponse.json()) as UploadAuth;

    if (!authResponse.ok) {
      throw new Error(auth.error || "Could not authorize logo upload.");
    }

    const data = new FormData();
    data.append("file", selectedFile);
    data.append("api_key", auth.apiKey);
    data.append("timestamp", String(auth.timestamp));
    data.append("folder", auth.folder);
    data.append("signature", auth.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`,
      { method: "POST", body: data },
    );

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      throw new Error(
        result.error?.message || "The logo upload failed. Try again.",
      );
    }

    return result.secure_url as string;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      let logoUrl = removeLogo ? "" : form.logo_url;

      if (selectedFile) {
        setUploading(true);
        logoUrl = await uploadLogo();
        setUploading(false);
      }

      const settings = { ...form, logo_url: logoUrl };

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }

      setForm({ ...defaults, ...data.settings });
      setSelectedFile(null);
      setRemoveLogo(false);

      if (fileInput.current) fileInput.current.value = "";

      setMessage("Shop settings and logo saved successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-dashboard">
        <section className="admin-panel">
          <p>Loading shop settings…</p>
        </section>
      </main>
    );
  }

  const preview = localPreview || (removeLogo ? "" : form.logo_url);

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="eyebrow">STORE MANAGEMENT</p>
          <h1>Shop Settings</h1>
          <p>
            Personalise your storefront, update your contact details, and
            explain your delivery arrangements.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push("/admin")}
        >
          Back to dashboard
        </button>
      </header>

      {message && (
        <p role="status" className="admin-success">{message}</p>
      )}

      {error && (
        <p role="alert" className="admin-error">{error}</p>
      )}

      <section className="admin-panel">
        <h1>Store information</h1>
        <p>These details can be displayed to customers on your shop website.</p>

        <form onSubmit={save} className="admin-form">
          <label>
            Shop name *
            <input
              required
              maxLength={100}
              value={form.shop_name}
              onChange={(e) => update("shop_name", e.target.value)}
              placeholder="Your shop name"
            />
          </label>

          <label>
            Tagline
            <input
              maxLength={160}
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Style · Scent · Everyday"
            />
          </label>

          <label className="admin-full">
            Shop description
            <textarea
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Tell customers what your shop offers."
            />
          </label>

          <label>
            Contact phone
            <input
              type="tel"
              maxLength={40}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="Your contact number"
            />
          </label>

          <label>
            WhatsApp number
            <input
              type="tel"
              maxLength={40}
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="Number customers can message"
            />
          </label>

          <label className="admin-full">
            Delivery and collection information
            <textarea
              rows={4}
              maxLength={1500}
              value={form.delivery_info}
              onChange={(e) => update("delivery_info", e.target.value)}
              placeholder="Areas served, delivery arrangements, fees and collection instructions."
            />
          </label>

          <div className="admin-full logo-upload-panel">
            <h2>Shop logo</h2>
            <p className="admin-muted">
              Upload a PNG, JPG or WebP logo. A transparent PNG often works
              particularly well on the storefront.
            </p>

            <div className="logo-upload-preview">
              {preview ? (
                <img
                  src={preview}
                  alt="Shop logo preview"
                  onError={() => setError("The logo preview could not be loaded.")}
                />
              ) : (
                <div className="logo-upload-empty">
                  <span>✳</span>
                  <small>YOUR LOGO</small>
                </div>
              )}
            </div>

            <label className="logo-file-label">
              Choose logo image
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => chooseLogo(event.target.files?.[0])}
              />
            </label>

            {selectedFile && (
              <p className="admin-muted">
                Selected: {selectedFile.name} ·{" "}
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}

            {form.logo_url && !removeLogo && !selectedFile && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setRemoveLogo(true);
                  setMessage("");
                }}
              >
                Remove current logo
              </button>
            )}

            {removeLogo && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRemoveLogo(false)}
              >
                Keep current logo
              </button>
            )}

            <details className="logo-url-fallback">
              <summary>Or enter an existing image URL</summary>
              <label>
                Shop logo image URL
                <input
                  type="url"
                  maxLength={1000}
                  value={removeLogo ? "" : form.logo_url}
                  onChange={(event) => {
                    update("logo_url", event.target.value);
                    setRemoveLogo(false);
                    setSelectedFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  placeholder="https://example.com/your-logo.png"
                />
              </label>
            </details>

            <p className="admin-muted">
              Your logo is uploaded when you click Save shop settings.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="admin-full"
          >
            {uploading
              ? "Uploading logo…"
              : saving
                ? "Saving changes…"
                : "Save shop settings"}
          </button>
        </form>
      </section>
    </main>
  );
}

