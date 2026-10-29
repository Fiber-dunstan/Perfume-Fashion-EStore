"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: number;
  product_count: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_minor: number;
  sku: string | null;
  category_id: string;
  category_name: string | null;
  images: { url: string; alt: string }[];
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: number;
  is_featured: number;
};

const emptyProduct = {
  name: "",
  slug: "",
  description: "",
  price: "",
  sku: "",
  categoryId: "",
  imageUrl: "",
  stockQuantity: "0",
  lowStockThreshold: "2",
  isActive: true,
  isFeatured: false,
};

function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminDashboard() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const load = useCallback(async () => {
    const auth = await fetch("/api/admin/me", { credentials: "same-origin" });

    if (!auth.ok) {
      router.replace("/admin/login");
      return;
    }

    const [categoryResponse, productResponse] = await Promise.all([
      fetch("/api/admin/categories"),
      fetch("/api/admin/products"),
    ]);

    if (!categoryResponse.ok || !productResponse.ok) {
      setError("Could not load store data. Please reload the page.");
      return;
    }

    const categoryData = await categoryResponse.json();
    const productData = await productResponse.json();

    setCategories(categoryData.categories);
    setProducts(productData.products);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function request(
    url: string,
    method: string,
    body?: unknown,
  ) {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    return data;
  }

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const name = categoryName.trim();

      await request("/api/admin/categories", "POST", {
        name,
        slug: slugify(name),
        description: categoryDescription,
        isActive: true,
      });

      setCategoryName("");
      setCategoryDescription("");
      setMessage("Category created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create category.");
    } finally {
      setBusy(false);
    }
  }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      let images: { url: string; alt: string }[] = form.imageUrl.trim()
        ? [{ url: form.imageUrl.trim(), alt: form.name }]
        : [];

      if (imageFiles.length) {
        const authResponse = await fetch("/api/admin/uploads/sign", {
          method: "POST",
          credentials: "same-origin",
        });
        const auth = await authResponse.json();

        if (!authResponse.ok) {
          throw new Error(auth.error || "Could not authorize image upload.");
        }

        const uploaded = await Promise.all(imageFiles.map(async (file) => {
          const data = new FormData();
          data.append("file", file);
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
            throw new Error(result.error?.message || `Upload failed: ${file.name}`);
          }

          return { url: result.secure_url as string, alt: form.name.trim() };
        }));

        images = [...images, ...uploaded];
      }

      await request("/api/admin/products", "POST", {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        description: form.description,
        priceMinor: Math.round(Number(form.price) * 100),
        currency: "GHS",
        sku: form.sku.trim() || null,
        categoryId: form.categoryId,
        images,
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
      });

      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setImageFiles([]);
      setImagePreviews([]);
      setForm(emptyProduct);
      setMessage("Product created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create product.");
    } finally {
      setBusy(false);
    }
  }

  async function changeProduct(product: Product) {
    const price = window.prompt(
      `New price in GHS for ${product.name}:`,
      (Number(product.price_minor) / 100).toFixed(2),
    );
    if (price === null) return;

    const stock = window.prompt(
      `New stock quantity for ${product.name}:`,
      String(product.stock_quantity),
    );
    if (stock === null) return;

    const priceNumber = Number(price);
    const stockNumber = Number(stock);

    if (!Number.isFinite(priceNumber) || priceNumber < 0 ||
        !Number.isInteger(stockNumber) || stockNumber < 0) {
      setError("Enter a valid non-negative price and whole-number stock quantity.");
      return;
    }

    try {
      await request(`/api/admin/products/${product.id}`, "PATCH", {
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        priceMinor: Math.round(priceNumber * 100),
        currency: "GHS",
        sku: product.sku,
        categoryId: product.category_id,
        images: product.images || [],
        stockQuantity: stockNumber,
        lowStockThreshold: product.low_stock_threshold,
        isActive: Boolean(product.is_active),
        isFeatured: Boolean(product.is_featured),
      });

      setMessage("Product updated.");
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update product.");
    }
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(`Archive "${product.name}"? It will no longer appear in the public store.`)) {
      return;
    }

    try {
      await request(`/api/admin/products/${product.id}`, "DELETE");
      setMessage("Product archived.");
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive product.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="eyebrow">STORE MANAGEMENT</p>
          <h1>Admin dashboard</h1>
          <p>Manage your products, categories and stock.</p>
        </div>

        <div className="admin-header-actions">
          <details className="admin-menu">
            <summary className="admin-menu-trigger">
              Management Menu <span aria-hidden="true">▾</span>
            </summary>
            <nav className="admin-menu-dropdown" aria-label="Admin navigation">
              <a href="/admin">Dashboard</a>
              <a href="/admin#categories">Categories</a>
              <a href="/admin#products">Products</a>
              <a href="/admin/orders">Manage Orders</a>
              <a href="/admin/settings">Shop Settings</a>
            </nav>
          </details>

          <button type="button" className="secondary-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {message && <p className="admin-success" role="status">{message}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-panel">
        <h2>Add a category</h2>
        <form onSubmit={addCategory} className="admin-form">
          <label>
            Category name
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Perfumes"
              required
            />
          </label>
          <label>
            Description
            <input
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              placeholder="Optional description"
            />
          </label>
          <button disabled={busy}>Add category</button>
        </form>

        <p className="admin-muted">
          Existing categories: {categories.map((c) => c.name).join(", ") || "None yet"}
        </p>
      </section>

      <section className="admin-panel">
        <h2>Add a product</h2>
        <form onSubmit={addProduct} className="admin-form">
          <label>
            Product name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
              required
            />
          </label>

          <label>
            URL slug
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />
          </label>

          <label>
            Category
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Price (GHS)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </label>

          <label>
            SKU (optional)
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>

          <label>
            Initial stock
            <input
              type="number"
              min="0"
              step="1"
              value={form.stockQuantity}
              onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
              required
            />
          </label>

          <label>
            Low-stock alert threshold
            <input
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
              required
            />
          </label>

          <label>
            Image URL (optional fallback)
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </label>

          <div className="admin-full">
            <label htmlFor="product-images">Upload product images (up to 5)</label>
            <input
              id="product-images"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={busy}
              onChange={(e) => {
                const selected = Array.from(e.currentTarget.files ?? []);
                if (selected.length > 5) {
                  setError("Choose no more than 5 images.");
                  e.currentTarget.value = "";
                  return;
                }
                const invalid = selected.find((file) =>
                  !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
                  || file.size > 5 * 1024 * 1024
                );
                if (invalid) {
                  setError("Use JPG, PNG, WEBP, or AVIF images no larger than 5 MB each.");
                  e.currentTarget.value = "";
                  return;
                }
                imagePreviews.forEach((url) => URL.revokeObjectURL(url));
                setError("");
                setImageFiles(selected);
                setImagePreviews(selected.map((file) => URL.createObjectURL(file)));
              }}
            />
            <p>Choose up to five JPG, PNG, WEBP, or AVIF images, maximum 5 MB each.</p>
            {imagePreviews.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                {imagePreviews.map((src, index) => (
                  <div key={src} style={{ width: 112 }}>
                    <img
                      src={src}
                      alt={`Product preview ${index + 1}`}
                      style={{ width: 112, height: 100, objectFit: "cover", borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        URL.revokeObjectURL(src);
                        setImageFiles((current) => current.filter((_, i) => i !== index));
                        setImagePreviews((current) => current.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="admin-full">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
          </label>

          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Visible in store
          </label>

          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            Featured product
          </label>

          <button disabled={busy || categories.filter((c) => c.is_active).length === 0}>
            Add product
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>Products ({products.filter((p) => !p.archived_at).length})</h2>

        {products.filter((p) => !p.archived_at).length === 0 ? (
          <p className="admin-muted">No products yet. Add your first product above.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.filter((p) => !p.archived_at).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category_name || "Uncategorised"}</td>
                    <td>GH₵ {(Number(p.price_minor) / 100).toFixed(2)}</td>
                    <td>{p.stock_quantity}</td>
                    <td>{p.is_active ? "Active" : "Hidden"}</td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="secondary-button" onClick={() => void changeProduct(p)}>
                          Edit price/stock
                        </button>
                        <button type="button" className="danger-button" onClick={() => void archiveProduct(p)}>
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
