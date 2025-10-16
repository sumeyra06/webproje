import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/health', (req, res) => res.json({ ok: true, service: 'mp-backend', time: new Date().toISOString() }));

// Simple echo for connectivity testing
app.post('/echo', (req, res) => {
	res.json({ ok: true, received: req.body || null, time: new Date().toISOString() });
});

// Trendyol products ingest (mock). Validates payload shape and responds.
app.post('/trendyol/products', (req, res) => {
	try {
		const body = req.body || {};
		// Support both shapes:
		// - { apiKey, apiSecret, supplierId, products: [...] }
		// - { username, password, items: [...] }
		const apiKey = body.apiKey || body.username;
		const apiSecret = body.apiSecret || body.password;
		const supplierId = body.supplierId; // optional in legacy shape
		const list = body.products || body.items || [];
		if (!apiKey || !apiSecret || !Array.isArray(list)) {
			return res.status(400).json({ ok: false, error: 'Missing credentials or list' });
		}
		// Here you would call Trendyol API using apiKey/apiSecret and supplierId
		// For now, just respond with a mock result.
		return res.json({ ok: true, accepted: list.length, supplierId: supplierId || null });
	} catch (e) {
		return res.status(500).json({ ok: false, error: e?.message || String(e) });
	}
});

// Trendyol orders list (mock). Accepts { apiKey, apiSecret, supplierId, page, size, status, startDate, endDate }
app.post('/trendyol/orders', async (req, res) => {
	try {
		const body = req.body || {};

		const apiKey = body.apiKey;
		const apiSecret = body.apiSecret;
		const supplierId = body.supplierId;
		if (!apiKey || !apiSecret || !supplierId) return res.status(400).json({ ok: false, error: 'Missing credentials' });
		const page = Number(body.page || 0);
		const size = Math.min(Number(body.size || 20), 100);
		const status = body.status || 'ALL';
		let startDate = body.startDate || null;
		let endDate = body.endDate || null;

		// Build Trendyol request
		const base = 'https://api.trendyol.com/sapigw';
		const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
			const params = {
			page,
			size,
		};
			if (status && status !== 'ALL') {
				// Defensive: set multiple knobs some Trendyol variants accept
				params.status = status;            // common
				params.orderStatus = status;       // alt alias seen in some responses
				if (status === 'Shipped' || status === 'Delivered') {
					params.shipmentStatus = status;  // shipment-related states
				}
			}
			// Default date range: last 30 days if not provided
			const nowMs = Date.now();
			const startMs = startDate ? new Date(startDate).getTime() : (nowMs - 30 * 24 * 60 * 60 * 1000);
			const endMs = endDate ? new Date(endDate).getTime() : nowMs;
			if (!isNaN(startMs)) params.startDate = startMs;
			if (!isNaN(endMs)) params.endDate = endMs;

		const resp = await axios.get(`${base}/suppliers/${encodeURIComponent(supplierId)}/orders`, {
			headers: {
				'Authorization': `Basic ${auth}`,
				'Content-Type': 'application/json',
				'User-Agent': 'AksaYazilim/1.0 (+support@aksa.local)'
			},
			params
		});
		const data = resp.data || {};
		const list = Array.isArray(data.content) ? data.content : (Array.isArray(data.orders) ? data.orders : []);
		const items = list.map((o, i) => {
			const created = o.orderDate || o.createDate || o.lastModifiedDate || Date.now();
			const fullName = (o.shipmentAddress && (o.shipmentAddress.fullName || `${o.shipmentAddress.firstName || ''} ${o.shipmentAddress.lastName || ''}`.trim()))
				|| (o.customerFirstName || o.customerLastName ? `${o.customerFirstName || ''} ${o.customerLastName || ''}`.trim() : null)
				|| (o.buyerName || null);
			const lines = Array.isArray(o.lines) ? o.lines : (Array.isArray(o.items) ? o.items.map(it => ({
				sku: it.sku || it.barcode || it.productMainId || '',
				name: it.productName || it.title || '',
				qty: it.quantity || it.qty || 1,
				price: it.price || it.salePrice || 0
			})) : []);
			return {
				id: o.id ?? o.orderNumber ?? `ORD-${i}`,
				orderNumber: o.orderNumber || String(o.id || ''),
				status: o.status || o.orderStatus || 'Unknown',
				customer: fullName || '-',
				totalPrice: o.totalPrice || o.totalAmount || 0,
				currency: o.currency || 'TRY',
				createdAt: new Date(created).toISOString(),
				lines
			};
		});
			const total = data.totalElements ?? data.totalCount ?? (data.totalPages ? data.totalPages * size : items.length);
			if (!items.length) {
				console.warn('[trendyol/orders] Empty result', { params });
			}
			return res.json({ ok: true, page, size, total, items, filters: { status, startDate, endDate } });
	} catch (e) {
		// Return detailed error for troubleshooting
		const status = e?.response?.status;
		const errPayload = {
			ok: false,
			error: e?.message || String(e),
			status,
			data: e?.response?.data || null
		};
		return res.status(status || 500).json(errPayload);
	}
});

app.listen(PORT, () => {
	console.log(`Marketplace backend listening on http://localhost:${PORT}`);
});

