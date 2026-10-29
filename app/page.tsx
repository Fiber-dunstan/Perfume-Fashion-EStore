"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  product_count?: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price?: number;
  price_minor?: number;
  currency?: string;
  category_id?: string;
  categoryId?: string;
  category_name?: string;
  categoryName?: string;
  images?: Array<{ url?: string; alt?: string }>;
  is_featured?: boolean;
  isFeatured?: boolean;
  stock_quantity?: number;
  stockQuantity?: number;
  inStock?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type StoreSettings = {
  shop_name: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  delivery_info: string;
  logo_url: string;
};

const defaultStoreSettings: StoreSettings = {
  shop_name: "YOUR STORE",
  tagline: "STYLE · SCENT · EVERYDAY",
  description: "Explore fragrances, fashion, accessories and everyday essentials.",
  phone: "",
  whatsapp: "",
  delivery_info: "",
  logo_url: "",
};

const money = (product: Product) => {
  const amount =
    typeof product.price === "number"
      ? product.price
      : (product.price_minor ?? 0) / 100;

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(amount);
};

function imageFor(product: Product) {
  return product.images?.[0]?.url || "";
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("perfume-fashion-store-cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed as CartItem[]);
      }
    } catch {
      localStorage.removeItem("perfume-fashion-store-cart");
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    localStorage.setItem("perfume-fashion-store-cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      try {
        const [categoryResponse, productResponse, settingsResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/products?limit=48"),
          fetch("/api/store-settings", { cache: "no-store" }),
        ]);

        if (!categoryResponse.ok || !productResponse.ok) {
          throw new Error("The store could not load its products.");
        }

        const categoryData = await categoryResponse.json();
        const productData = await productResponse.json();
        let settingsData: StoreSettings = defaultStoreSettings;

        if (settingsResponse.ok) {
          const receivedSettings = await settingsResponse.json();
          settingsData = { ...defaultStoreSettings, ...receivedSettings };
        }

        if (!cancelled) {
          setCategories(categoryData.categories ?? []);
          setProducts(productData.products ?? []);
          setSettings(settingsData);
        }
      } catch {
        if (!cancelled) {
          setError("We could not load the store. Please refresh the page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStore();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "all" ||
        product.category_id === category ||
        product.categoryId === category;

      const matchesSearch =
        !term ||
        product.name?.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.category_name?.toLowerCase().includes(term) ||
        product.categoryName?.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartTotal = cart.reduce((sum, item) => {
    const amount =
      typeof item.product.price === "number"
        ? item.product.price
        : (item.product.price_minor ?? 0) / 100;

    return sum + amount * item.quantity;
  }, 0);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { product, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function changeQuantity(productId: string, change: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <main className="store-shell">
      <div className="store-announcement">
        A little something special, just for you.
      </div>

      <header className="store-header">
        <a className="store-brand" href="/" aria-label="Home">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={`${settings.shop_name} logo`}
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }}
            />
          ) : (
            <span className="store-brand-mark">
              {settings.shop_name.trim().charAt(0).toUpperCase() || "S"}
            </span>
          )}
          <span>
            <strong>{settings.shop_name}</strong>
            <small>{settings.tagline}</small>
          </span>
        </a>

        <nav className="store-nav" aria-label="Main navigation">
          <a href="#shop">Shop</a>
          <a href="#categories">Categories</a>
          <a href="#about">About</a>
        </nav>

        <button
          className="store-cart-button"
          onClick={() => setCartOpen(true)}
          type="button"
        >
          Bag ({cartCount})
        </button>
      </header>

      <section className="store-hero">
        <div className="store-hero-copy">
          <p className="store-eyebrow">YOUR STYLE, YOUR SIGNATURE</p>
          <h1>Find your next favourite.</h1>
          <p>{settings.description}</p>
          <a className="store-primary-button" href="#shop">
            Explore the collection <span aria-hidden="true">↗</span>
          </a>
          <div className="store-hero-note">
            <span>✦</span> Easy ordering · Personal service · Ghana
          </div>
        </div>

        <div className="store-hero-art" aria-hidden="true">
          <div className="store-art-circle" />
          <div className="store-art-card store-art-card-back">
            <span>THE EVERYDAY EDIT</span>
          </div>
          <div className="store-art-card store-art-card-front">
            <div className="store-art-bottle">
              <div className="store-art-cap" />
              <div className="store-art-liquid">
                <span>YOUR</span>
                <strong>SIGNATURE</strong>
                <small>EAU DE PARFUM</small>
              </div>
            </div>
          </div>
          <div className="store-art-stamp">A LITTLE LUXURY</div>
        </div>
      </section>

      <section className="store-benefits" aria-label="Shopping benefits">
        <div><span>✳</span><p><strong>Thoughtfully selected</strong><small>Find pieces you'll love</small></p></div>
        <div><span>◇</span><p><strong>Personal service</strong><small>We confirm orders with you</small></p></div>
        <div><span>♡</span><p><strong>Simple ordering</strong><small>Pay after confirmation</small></p></div>
      </section>

      <section className="store-section" id="categories">
        <div className="store-section-heading">
          <div>
            <p className="store-eyebrow">BROWSE YOUR WAY</p>
            <h2>Shop by category</h2>
          </div>
          <span className="store-muted">Find something that feels like you.</span>
        </div>

        <div className="store-category-list">
          <button
            className={category === "all" ? "store-category active" : "store-category"}
            onClick={() => setCategory("all")}
            type="button"
          >
            All products <span>↗</span>
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={category === item.id ? "store-category active" : "store-category"}
              onClick={() => setCategory(item.id)}
              type="button"
            >
              {item.name} <span>↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="store-section store-products-section" id="shop">
        <div className="store-section-heading">
          <div>
            <p className="store-eyebrow">THE COLLECTION</p>
            <h2>Little things. Big favourites.</h2>
          </div>

          <label className="store-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
            />
          </label>
        </div>

        {error && <p className="store-message">{error}</p>}

        {loading ? (
          <div className="store-empty">
            <span className="store-loading-dot" />
            <p>Finding your favourites…</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="store-empty">
            <span className="store-empty-icon">✳</span>
            <h3>{products.length === 0 ? "Your collection starts here." : "Nothing matched this search."}</h3>
            <p>
              {products.length === 0
                ? "Products you add through the admin dashboard will appear here."
                : "Try another search or browse a different category."}
            </p>
            {search && (
              <button
                className="store-text-button"
                onClick={() => setSearch("")}
                type="button"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="store-product-grid">
            {filteredProducts.map((product) => {
              const image = imageFor(product);
              const stock = product.stock_quantity ?? product.stockQuantity;
              const outOfStock =
                product.inStock === false ||
                (typeof stock === "number" && stock <= 0);

              return (
                <article className="store-product-card" key={product.id}>
                  <div className="store-product-image">
                    {image ? (
                      // Product URLs are supplied by the product record.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={product.images?.[0]?.alt || product.name} loading="lazy" />
                    ) : (
                      <div className="store-product-placeholder">
                        <span>✳</span>
                        <small>{product.category_name || product.categoryName || "THE COLLECTION"}</small>
                      </div>
                    )}
                    {(product.is_featured || product.isFeatured) && (
                      <span className="store-product-badge">A favourite</span>
                    )}
                    {outOfStock && <span className="store-product-badge sold-out">Sold out</span>}
                  </div>

                  <div className="store-product-info">
                    <p className="store-product-category">
                      {product.category_name || product.categoryName || "THE COLLECTION"}
                    </p>
                    <h3>{product.name}</h3>
                    {product.description && <p className="store-product-description">{product.description}</p>}
                    <div className="store-product-bottom">
                      <strong>{money(product)}</strong>
                      <button
                        type="button"
                        className="store-add-button"
                        disabled={outOfStock}
                        onClick={() => addToCart(product)}
                        aria-label={`Add ${product.name} to bag`}
                      >
                        {outOfStock ? "Unavailable" : "Add to bag +"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="store-about" id="about">
        <div className="store-about-symbol">
          {(settings.shop_name.trim().slice(0, 2) || "S.").toUpperCase()}
        </div>
        <div>
          <p className="store-eyebrow">A MORE PERSONAL WAY TO SHOP</p>
          <h2>Good finds. A little more personal.</h2>
          <p>
            Browse at your own pace. When you're ready, send us your order and
            we'll contact you to confirm availability, delivery details and
            the final amount before you pay.
          </p>
        </div>
      </section>

      <footer className="store-footer">
        <a className="store-footer-brand" href="/">{settings.shop_name}</a>
        <span>{settings.tagline}</span>
        {settings.phone && <a href={`tel:${settings.phone}`}>Call: {settings.phone}</a>}
        {settings.whatsapp && (
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            Chat on WhatsApp
          </a>
        )}
        {settings.delivery_info && <small>{settings.delivery_info}</small>}
        <a href="/admin/login">Store administrator</a>
        <small>© {new Date().getFullYear()} {settings.shop_name}</small>
      </footer>

      {cartOpen && (
        <div className="store-drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="store-cart-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Shopping bag"
            role="dialog"
            aria-modal="true"
          >
            <div className="store-drawer-heading">
              <div>
                <p className="store-eyebrow">YOUR PICKS</p>
                <h2>Your shopping bag ({cartCount})</h2>
              </div>
              <button className="store-close-button" onClick={() => setCartOpen(false)} type="button" aria-label="Close bag">×</button>
            </div>

            {cart.length === 0 ? (
              <div className="store-empty store-cart-empty">
                <span className="store-empty-icon">♡</span>
                <h3>Your bag is waiting.</h3>
                <p>Explore the collection and add something you love.</p>
                <button className="store-primary-button" onClick={() => setCartOpen(false)} type="button">Continue shopping</button>
              </div>
            ) : (
              <>
                <div className="store-cart-items">
                  {cart.map((item) => (
                    <div className="store-cart-item" key={item.product.id}>
                      <div className="store-cart-thumb">
                        {imageFor(item.product) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageFor(item.product)} alt="" />
                        ) : <span>✳</span>}
                      </div>
                      <div className="store-cart-item-info">
                        <strong>{item.product.name}</strong>
                        <span>{money(item.product)}</span>
                        <div className="store-quantity-control">
                          <button type="button" onClick={() => changeQuantity(item.product.id, -1)} aria-label="Decrease quantity">−</button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => changeQuantity(item.product.id, 1)} aria-label="Increase quantity">+</button>
                        </div>
                      </div>
                      <button className="store-remove-item" type="button" onClick={() => setCart((current) => current.filter((entry) => entry.product.id !== item.product.id))}>Remove</button>
                    </div>
                  ))}
                </div>
                <div className="store-cart-summary">
                  <div><span>Subtotal</span><strong>{new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(cartTotal)}</strong></div>
                  <p>Delivery and final availability will be confirmed with you before payment.</p>
                  <button
                    type="button"
                    className="store-primary-button store-checkout-button"
                    onClick={() => {
                      setCartOpen(false);
                      window.location.href = "/checkout";
                    }}
                  >
                    Continue to checkout <span aria-hidden="true">→</span>
                  </button>
                  <button className="store-text-button" onClick={() => setCartOpen(false)} type="button">Keep shopping</button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
