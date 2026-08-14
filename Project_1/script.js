    (function () {
      'use strict';

      /* ============ MOCK DATA ============ */
      const PRODUCTS = [
        {
          id: 'p1', title: 'Kobo Pour-Over Set', category: 'Coffee', price: 68,
          img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
          desc: 'A hand-thrown stoneware dripper paired with a matching carafe. Each piece carries the faint spiral of the wheel — no two pours look quite the same.',
          tag: 'Bestseller', material: 'Stoneware', origin: 'Kyoto, JP'
        },
        {
          id: 'p2', title: 'Amber Table Lamp', category: 'Lighting', price: 122,
          img: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
          desc: 'Blown amber glass over a blackened brass base. The warm cast is designed for evenings — low, generous, and easy on the eyes.',
          tag: 'New', material: 'Glass & Brass', origin: 'Murano, IT'
        },
        {
          id: 'p3', title: 'Linen Napkin Set of 4', category: 'Table', price: 38,
          img: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=800&q=80',
          desc: 'Stonewashed European linen, softened over repeated washes. Sold in a set of four with a hand-rolled hem.',
          tag: null, material: '100% Linen', origin: 'Normandy, FR'
        },
        {
          id: 'p4', title: 'Oak Serving Board', category: 'Table', price: 56,
          img: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
          desc: 'A single slab of European oak, oiled and ready for bread, cheese, or a quiet Sunday spread. The grain is never repeated twice.',
          tag: null, material: 'European Oak', origin: 'Vermont, US'
        },
        {
          id: 'p5', title: 'Terra Planter, Large', category: 'Home', price: 74,
          img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80',
          desc: 'Unglazed terracotta that patinas with every watering. Drainage dish included. Built for a fig tree, not a succulent.',
          tag: 'Bestseller', material: 'Terracotta', origin: 'Puglia, IT'
        },
        {
          id: 'p6', title: 'Brass Pour Kettle', category: 'Coffee', price: 96,
          img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
          desc: 'A gooseneck kettle in solid brass with a walnut handle. Weighted for a slow, controlled pour over the Kobo dripper.',
          tag: 'New', material: 'Brass & Walnut', origin: 'Portland, US'
        },
        {
          id: 'p7', title: 'Woven Storage Basket', category: 'Home', price: 44,
          img: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80',
          desc: 'Hand-woven seagrass with a leather-wrapped handle. Sturdy enough for firewood, soft-sided enough for throws.',
          tag: null, material: 'Seagrass & Leather', origin: 'Java, ID'
        },
        {
          id: 'p8', title: 'Stoneware Mug Pair', category: 'Coffee', price: 34,
          img: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80',
          desc: 'A pair of matte-glazed mugs sized for a proper pour-over. Sold together because coffee is better with company.',
          tag: null, material: 'Stoneware', origin: 'Kyoto, JP'
        }
      ];

      /* ============ STATE / STORAGE HELPERS ============ */
      const DB = {
        get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
        set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
      };

      const state = {
        cart: DB.get('vessel_cart', []),          // [{id, qty}]
        users: DB.get('vessel_users', []),        // [{name, email, password}]
        currentUser: DB.get('vessel_current_user', null),
        orders: DB.get('vessel_orders', []),
        activeFilter: 'All',
        authMode: 'login'
      };

      function persist() {
        DB.set('vessel_cart', state.cart);
        DB.set('vessel_users', state.users);
        DB.set('vessel_current_user', state.currentUser);
        DB.set('vessel_orders', state.orders);
      }

      function findProduct(id) { return PRODUCTS.find(p => p.id === id); }
      function fmt(n) { return '$' + n.toFixed(2).replace(/\.00$/, ''); }

      /* ============ TOAST ============ */
      let toastTimer;
      function showToast(msg, icon) {
        const t = document.getElementById('toast');
        t.innerHTML = (icon || '&#10003;') + '&nbsp;&nbsp;' + msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
      }

      /* ============ OVERLAY HELPERS ============ */
      function openOverlay(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
      function closeOverlay(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }
      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeOverlay(btn.getAttribute('data-close')));
      });
      document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov.id); });
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { document.querySelectorAll('.overlay.active').forEach(ov => closeOverlay(ov.id)); }
      });

      /* ============ RENDER: FILTERS ============ */
      function renderFilters() {
        const cats = ['All', ...new Set(PRODUCTS.map(p => p.category))];
        const row = document.getElementById('filterRow');
        row.innerHTML = cats.map(c =>
          `<button class="filter-chip ${c === state.activeFilter ? 'active' : ''}" data-cat="${c}">${c}</button>`
        ).join('');
        row.querySelectorAll('.filter-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            state.activeFilter = chip.getAttribute('data-cat');
            renderFilters();
            renderGrid();
          });
        });
      }

      /* ============ RENDER: PRODUCT GRID ============ */
      function renderGrid() {
        const list = state.activeFilter === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.category === state.activeFilter);
        document.getElementById('resultCount').textContent = list.length + ' object' + (list.length !== 1 ? 's' : '');
        const grid = document.getElementById('productGrid');
        grid.innerHTML = list.map(p => `
      <article class="card glass" data-id="${p.id}">
        <div class="card-img">
          ${p.tag ? `<span class="card-tag">${p.tag}</span>` : ''}
          <img src="${p.img}" alt="${p.title}" loading="lazy">
          <button class="quick-add" data-quickadd="${p.id}" aria-label="Add ${p.title} to cart">+</button>
        </div>
        <div class="card-body">
          <div class="card-cat">${p.category}</div>
          <div class="card-title">${p.title}</div>
          <div class="card-foot">
            <span class="price">${fmt(p.price)}</span>
            <button class="add-btn" data-quickadd="${p.id}">Add to Bag</button>
          </div>
        </div>
      </article>
    `).join('');

        grid.querySelectorAll('.card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('[data-quickadd]')) return;
            openProductModal(card.getAttribute('data-id'));
          });
        });
        grid.querySelectorAll('[data-quickadd]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(btn.getAttribute('data-quickadd'));
          });
        });
      }

      /* ============ PRODUCT MODAL ============ */
      function openProductModal(id) {
        const p = findProduct(id);
        if (!p) return;
        document.getElementById('productModalContent').innerHTML = `
      <button class="modal-close" data-close="productOverlay">&times;</button>
      <div class="pd-grid">
        <div class="pd-img"><img src="${p.img}" alt="${p.title}"></div>
        <div class="pd-info">
          <div class="card-cat">${p.category}</div>
          <h2>${p.title}</h2>
          <div class="pd-price">${fmt(p.price)}</div>
          <p class="pd-desc">${p.desc}</p>
          <div class="pd-meta">
            <div><strong>${p.material}</strong>Material</div>
            <div><strong>${p.origin}</strong>Origin</div>
          </div>
          <div class="pd-actions">
            <button class="btn btn-primary" id="pdAddBtn" data-id="${p.id}">Add to Bag — ${fmt(p.price)}</button>
          </div>
        </div>
      </div>
    `;
        document.getElementById('productModalContent').querySelector('[data-close]')
          .addEventListener('click', () => closeOverlay('productOverlay'));
        document.getElementById('pdAddBtn').addEventListener('click', () => {
          addToCart(p.id);
          closeOverlay('productOverlay');
        });
        openOverlay('productOverlay');
      }

      /* ============ CART ============ */
      function addToCart(id, qty) {
        qty = qty || 1;
        const line = state.cart.find(l => l.id === id);
        if (line) { line.qty += qty; } else { state.cart.push({ id, qty }); }
        persist();
        renderCartBadge();
        renderCartDrawer();
        const p = findProduct(id);
        showToast(`${p.title} added to your bag`);
      }

      function updateQty(id, delta) {
        const line = state.cart.find(l => l.id === id);
        if (!line) return;
        line.qty += delta;
        if (line.qty <= 0) { state.cart = state.cart.filter(l => l.id !== id); }
        persist();
        renderCartBadge();
        renderCartDrawer();
      }

      function removeFromCart(id) {
        state.cart = state.cart.filter(l => l.id !== id);
        persist();
        renderCartBadge();
        renderCartDrawer();
      }

      function cartTotal() {
        return state.cart.reduce((sum, l) => {
          const p = findProduct(l.id);
          return sum + (p ? p.price * l.qty : 0);
        }, 0);
      }

      function renderCartBadge() {
        const count = state.cart.reduce((s, l) => s + l.qty, 0);
        const badge = document.getElementById('cartBadge');
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }

      function renderCartDrawer() {
        const wrap = document.getElementById('cartItems');
        if (state.cart.length === 0) {
          wrap.innerHTML = `<div class="cart-empty">
        <div class="ce-icon">&#128717;</div>
        <div>Your bag is empty.</div>
        <div style="font-size:.78rem;">Add something you'll actually use.</div>
      </div>`;
        } else {
          wrap.innerHTML = state.cart.map(l => {
            const p = findProduct(l.id);
            if (!p) return '';
            return `
        <div class="cart-row">
          <img src="${p.img}" alt="${p.title}">
          <div class="cr-info">
            <div class="cr-title">${p.title}</div>
            <div class="cr-price">${fmt(p.price)}</div>
            <div class="cr-controls">
              <button class="qty-btn" data-qty="-1" data-id="${p.id}">&minus;</button>
              <span>${l.qty}</span>
              <button class="qty-btn" data-qty="1" data-id="${p.id}">&plus;</button>
              <button class="cr-remove" data-remove="${p.id}">Remove</button>
            </div>
          </div>
        </div>`;
          }).join('');
          wrap.querySelectorAll('[data-qty]').forEach(btn => {
            btn.addEventListener('click', () => updateQty(btn.getAttribute('data-id'), parseInt(btn.getAttribute('data-qty'), 10)));
          });
          wrap.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-remove')));
          });
        }
        document.getElementById('cartSubtotal').textContent = fmt(cartTotal());
      }

      document.getElementById('cartBtn').addEventListener('click', () => {
        renderCartDrawer();
        openOverlay('cartOverlay');
      });

      /* ============ AUTH ============ */
      function renderAuthModal() {
        const c = document.getElementById('authModalContent');
        if (state.authMode === 'login') {
          c.innerHTML = `
        <div class="form-pad">
          <h2>Welcome back</h2>
          <p class="form-sub">Log in to view your orders and saved bag.</p>
          <div class="form-error" id="authError"></div>
          <div class="field"><label>Email</label><input type="email" id="loginEmail" placeholder="you@example.com"></div>
          <div class="field"><label>Password</label><input type="password" id="loginPassword" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"></div>
          <button class="btn btn-primary" id="loginSubmit">Log In</button>
          <div class="form-switch">New to Vessel? <a href="#" id="toRegister">Create an account</a></div>
        </div>`;
          document.getElementById('toRegister').addEventListener('click', e => { e.preventDefault(); state.authMode = 'register'; renderAuthModal(); });
          document.getElementById('loginSubmit').addEventListener('click', doLogin);
          c.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
        } else {
          c.innerHTML = `
        <div class="form-pad">
          <h2>Create your account</h2>
          <p class="form-sub">Takes about fifteen seconds.</p>
          <div class="form-error" id="authError"></div>
          <div class="field"><label>Full Name</label><input type="text" id="regName" placeholder="Jordan Ellery"></div>
          <div class="field"><label>Email</label><input type="email" id="regEmail" placeholder="you@example.com"></div>
          <div class="field"><label>Password</label><input type="password" id="regPassword" placeholder="At least 6 characters"></div>
          <button class="btn btn-primary" id="regSubmit">Create Account</button>
          <div class="form-switch">Already have an account? <a href="#" id="toLogin">Log in</a></div>
        </div>`;
          document.getElementById('toLogin').addEventListener('click', e => { e.preventDefault(); state.authMode = 'login'; renderAuthModal(); });
          document.getElementById('regSubmit').addEventListener('click', doRegister);
          c.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); }));
        }
      }

      function doLogin() {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const pw = document.getElementById('loginPassword').value;
        const err = document.getElementById('authError');
        const user = state.users.find(u => u.email === email && u.password === pw);
        if (!user) { err.textContent = 'No matching account. Check your email and password.'; return; }
        state.currentUser = { name: user.name, email: user.email };
        persist();
        updateAuthUI();
        closeOverlay('authOverlay');
        showToast(`Welcome back, ${user.name.split(' ')[0]}`);
      }

      function doRegister() {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const pw = document.getElementById('regPassword').value;
        const err = document.getElementById('authError');
        if (!name || !email || !pw) { err.textContent = 'Please fill in every field.'; return; }
        if (pw.length < 6) { err.textContent = 'Password should be at least 6 characters.'; return; }
        if (state.users.some(u => u.email === email)) { err.textContent = 'An account with this email already exists.'; return; }
        const user = { name, email, password: pw };
        state.users.push(user);
        state.currentUser = { name, email };
        persist();
        updateAuthUI();
        closeOverlay('authOverlay');
        showToast(`Account created — welcome, ${name.split(' ')[0]}`);
      }

      function logout() {
        state.currentUser = null;
        persist();
        updateAuthUI();
        showToast('Logged out');
      }

      function updateAuthUI() {
        const btn = document.getElementById('authBtn');
        if (state.currentUser) {
          btn.textContent = `Welcome, ${state.currentUser.name.split(' ')[0]}`;
          btn.onclick = logout;
          btn.title = 'Click to log out';
        } else {
          btn.textContent = 'Log In';
          btn.onclick = () => { state.authMode = 'login'; renderAuthModal(); openOverlay('authOverlay'); };
        }
      }

      /* ============ CHECKOUT ============ */
      document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (state.cart.length === 0) { showToast('Your bag is empty', '&#9888;'); return; }
        closeOverlay('cartOverlay');
        renderCheckoutModal();
        openOverlay('checkoutOverlay');
      });

      function renderCheckoutModal() {
        const subtotal = cartTotal();
        const shipping = subtotal > 100 ? 0 : 8;
        const tax = subtotal * 0.0875;
        const total = subtotal + shipping + tax;
        const itemsHtml = state.cart.map(l => {
          const p = findProduct(l.id);
          return `<div class="co-item-mini"><span>${p.title} &times; ${l.qty}</span><span>${fmt(p.price * l.qty)}</span></div>`;
        }).join('');

        document.getElementById('checkoutModalContent').innerHTML = `
      <button class="modal-close" data-close="checkoutOverlay">&times;</button>
      <div class="checkout-grid">
        <div class="form-pad">
          <h2>Checkout</h2>
          <p class="form-sub">This is a front-end simulation — no real payment is processed.</p>
          <div class="form-error" id="checkoutError"></div>
          <div class="field"><label>Full Name</label><input type="text" id="coName" value="${state.currentUser ? state.currentUser.name : ''}" placeholder="Jordan Ellery"></div>
          <div class="field"><label>Email</label><input type="email" id="coEmail" value="${state.currentUser ? state.currentUser.email : ''}" placeholder="you@example.com"></div>
          <div class="field"><label>Shipping Address</label><input type="text" id="coAddress" placeholder="1200 Maple Street, Portland, OR"></div>
          <div class="field"><label>Card Number</label><input type="text" id="coCard" placeholder="4242 4242 4242 4242" maxlength="19"></div>
          <div style="display:flex; gap:1rem;">
            <div class="field" style="flex:1;"><label>Expiry</label><input type="text" id="coExpiry" placeholder="MM/YY" maxlength="5"></div>
            <div class="field" style="flex:1;"><label>CVC</label><input type="text" id="coCvc" placeholder="123" maxlength="4"></div>
          </div>
          <button class="btn btn-primary" id="placeOrderBtn">Place Order — ${fmt(total)}</button>
        </div>
        <div class="co-summary">
          <h4 style="margin-bottom:1rem;">Order Summary</h4>
          ${itemsHtml}
          <div class="co-line total"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
          <div class="co-line"><span>Shipping</span><span>${shipping === 0 ? 'Free' : fmt(shipping)}</span></div>
          <div class="co-line"><span>Estimated Tax</span><span>${fmt(tax)}</span></div>
          <div class="co-line total"><span>Total</span><span>${fmt(total)}</span></div>
        </div>
      </div>
    `;
        document.getElementById('checkoutModalContent').querySelector('[data-close]')
          .addEventListener('click', () => closeOverlay('checkoutOverlay'));
        document.getElementById('placeOrderBtn').addEventListener('click', () => placeOrder(subtotal, shipping, tax, total));
      }

      function placeOrder(subtotal, shipping, tax, total) {
        const name = document.getElementById('coName').value.trim();
        const email = document.getElementById('coEmail').value.trim();
        const address = document.getElementById('coAddress').value.trim();
        const card = document.getElementById('coCard').value.trim();
        const expiry = document.getElementById('coExpiry').value.trim();
        const cvc = document.getElementById('coCvc').value.trim();
        const err = document.getElementById('checkoutError');
        if (!name || !email || !address || !card || !expiry || !cvc) {
          err.textContent = 'Please complete every field to place your order.';
          return;
        }
        if (card.replace(/\s/g, '').length < 12) {
          err.textContent = 'Enter a valid card number.';
          return;
        }

        const order = {
          id: 'VSL-' + Date.now().toString().slice(-8),
          date: new Date().toISOString(),
          items: state.cart.map(l => {
            const p = findProduct(l.id);
            return { id: p.id, title: p.title, price: p.price, qty: l.qty };
          }),
          subtotal, shipping, tax, total,
          customer: { name, email, address },
          userEmail: state.currentUser ? state.currentUser.email : null
        };
        state.orders.unshift(order);
        state.cart = [];
        persist();
        renderCartBadge();

        document.getElementById('checkoutModalContent').innerHTML = `
      <button class="modal-close" data-close="checkoutOverlay">&times;</button>
      <div class="success-view">
        <div class="success-icon">&#10003;</div>
        <h2>Order placed</h2>
        <p>A confirmation has been sent to ${email}. Your objects are being wrapped now.</p>
        <div class="order-id">Order ${order.id}</div>
        <div>
          <button class="btn btn-primary" data-close="checkoutOverlay">Continue Browsing</button>
        </div>
      </div>
    `;
        document.querySelectorAll('#checkoutModalContent [data-close]').forEach(b => {
          b.addEventListener('click', () => closeOverlay('checkoutOverlay'));
        });
        showToast('Order placed successfully');
      }

      /* ============ ORDERS ============ */
      function renderOrdersModal() {
        const wrap = document.getElementById('ordersModalContent');
        const myOrders = state.currentUser
          ? state.orders.filter(o => o.userEmail === state.currentUser.email)
          : state.orders;

        if (!state.currentUser) {
          wrap.innerHTML = `
        <h2>Your Orders</h2>
        <p class="form-sub">Log in to keep a record of past orders tied to your account. Showing orders from this browser below.</p>
        ${myOrders.length === 0 ? '<p style="color:var(--bone-dim); font-size:.85rem;">No orders yet.</p>' : myOrders.map(orderCardHtml).join('')}
      `;
        } else {
          wrap.innerHTML = `
        <h2>Your Orders</h2>
        <p class="form-sub">${myOrders.length} order${myOrders.length !== 1 ? 's' : ''} on ${state.currentUser.email}</p>
        ${myOrders.length === 0 ? '<p style="color:var(--bone-dim); font-size:.85rem;">No orders yet — go treat yourself.</p>' : myOrders.map(orderCardHtml).join('')}
      `;
        }
      }

      function orderCardHtml(o) {
        const itemsList = o.items.map(i => `${i.title} &times;${i.qty}`).join(', ');
        return `
      <div style="border:1px solid var(--glass-border); padding:1rem; margin-bottom:0.9rem; border-radius:2px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.4rem;">
          <strong>${o.id}</strong><span>${fmt(o.total)}</span>
        </div>
        <div style="font-size:0.78rem; color:var(--bone-dim); margin-bottom:0.3rem;">${new Date(o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div style="font-size:0.78rem; color:var(--bone-dim);">${itemsList}</div>
      </div>`;
      }

      [document.getElementById('ordersLink'), document.getElementById('ordersLinkFooter')].forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          renderOrdersModal();
          openOverlay('ordersOverlay');
          document.getElementById('mainNav').classList.remove('open');
        });
      });

      /* ============ MOBILE NAV ============ */
      document.getElementById('hamburgerBtn').addEventListener('click', () => {
        document.getElementById('mainNav').classList.toggle('open');
      });
      document.querySelectorAll('#mainNav a').forEach(a => {
        a.addEventListener('click', () => document.getElementById('mainNav').classList.remove('open'));
      });

      /* ============ INIT ============ */
      renderFilters();
      renderGrid();
      renderCartBadge();
      updateAuthUI();

    })();