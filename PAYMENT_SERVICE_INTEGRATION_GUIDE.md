# Payment Service Integration Guide

Tai lieu nay dung cho mot project ben thu 3 tich hop vao `payment_service`.
Hay dua file nay cho agent/dev cua project khac truoc khi code tich hop.

## Muc tieu

`payment_service` la service thanh toan dung chung cho nhieu project.
Project ben thu 3 khong tu ket noi SePay truc tiep. Project ben thu 3 chi:

1. Goi `payment_service` de tao order thanh toan.
2. Hien thi `qr_code_url` cho nguoi dung quet.
3. Nhan callback tu `payment_service` khi order da thanh toan.
4. Co the polling API status neu muon cap nhat UI nhanh hon hoac fallback khi callback loi.

## Base URL

Production hien tai:

```text
https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net
```

Local neu chay cung may:

```text
http://localhost:5000
```

Trong code project ben thu 3 nen cau hinh bang env:

```env
PAYMENT_SERVICE_URL=https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net
PAYMENT_CLIENT_ID=client_demo_1
PAYMENT_API_KEY=demo_key_1_abc
APP_PUBLIC_URL=https://your-app-domain.com
```

`APP_PUBLIC_URL` la domain public cua project ben thu 3, dung de tao `callback_url`.
Trong production khong duoc dung `localhost` cho callback.

## Khai niem quan trong

### client_id va api_key

Moi project tich hop la mot client rieng trong database cua `payment_service`.
Moi request tu project ben thu 3 den `payment_service` phai gui 2 header:

```http
x-client-id: <client_id>
x-api-key: <api_key>
```

Neu thieu hoac sai mot trong hai header, API tra `401 Unauthorized`.

### order_id

`order_id` la ID thanh toan do `payment_service` tao ra.
Project ben thu 3 nen luu `order_id` vao don hang local de doi chieu ve sau.

### reference_code

`reference_code` la ma ngan gon de match giao dich ngan hang.
Payment service tu sinh neu project ben thu 3 khong gui.

Format hien tai:

```text
8-10 ky tu, chi gom A-Z va 0-9, khong dau, khong khoang trang
```

Nen de `payment_service` tu sinh, tranh loi format.

### payment_description

`payment_description` la noi dung chuyen khoan nguoi dung can chuyen.
Format hien tai:

```text
PS<reference_code>
```

Vi du:

```text
PSAB12CD34EF
```

Khong tu sua chuoi nay o app ben thu 3. Hay hien thi dung gia tri API tra ve.

### qr_code_url

`qr_code_url` la URL anh VietQR.
Project ben thu 3 chi can hien thi URL nay bang the `img` hoac link mo tab moi.

### callback_url

`callback_url` la endpoint cua project ben thu 3 de payment service bao ket qua paid.
Field nay duoc gui khi tao order va duoc payment service luu theo order.

Vi du:

```text
https://your-shop.com/api/payment-callback
```

Sau khi SePay bao co tien vao, payment service se update order sang `paid`, roi POST ve `callback_url`.

## Luong thanh toan end-to-end

Vi du user mua coffee gia 2.000 VND.

1. User bam mua coffee trong app ben thu 3.
2. App ben thu 3 tao order local voi status `pending`.
3. App ben thu 3 goi `POST /api/orders` cua payment service.
4. Payment service tao payment order va tra ve `qr_code_url`.
5. App ben thu 3 hien QR cho user quet.
6. User chuyen khoan dung so tien va dung noi dung chuyen khoan trong QR.
7. SePay goi webhook ve payment service.
8. Payment service verify HMAC, match `reference_code`, check so tien, update order `pending -> paid`.
9. Payment service POST callback ve `callback_url` cua app ben thu 3.
10. App ben thu 3 update don hang local sang `paid`.

So do:

```text
User
  -> Third-party app
  -> Payment service: POST /api/orders
  <- Payment service: qr_code_url
  -> Bank transfer via VietQR
SePay
  -> Payment service: POST /api/webhook/sepay
Payment service
  -> Third-party app: POST callback_url
Third-party app
  -> mark local order as paid
```

## API 1: Tao order thanh toan

### Request

```http
POST <PAYMENT_SERVICE_URL>/api/orders
Content-Type: application/json
x-client-id: <PAYMENT_CLIENT_ID>
x-api-key: <PAYMENT_API_KEY>
```

Body bat buoc:

```json
{
  "amount": 2000,
  "description": "Buy coffee",
  "callback_url": "https://your-shop.com/api/payment-callback"
}
```

Body day du, neu that su muon tu truyen `reference_code`:

```json
{
  "amount": 2000,
  "description": "Buy coffee",
  "reference_code": "AB12CD34",
  "callback_url": "https://your-shop.com/api/payment-callback"
}
```

Khuyen nghi: khong truyen `reference_code`, de payment service tu sinh.

### Field rules

`amount`:

- Bat buoc.
- Kieu `number`, khong phai string.
- Phai lon hon 0.
- Don vi la VND.
- Dung so nguyen, vi du `2000`, `50000`.

`description`:

- Bat buoc.
- Kieu string.
- Mo ta don hang cho noi bo, vi du `Buy coffee`, `Order #123`.
- Khong dung field nay lam noi dung chuyen khoan. Noi dung chuyen khoan dung `payment_description` tu response.

`callback_url`:

- Bat buoc.
- Kieu string.
- La URL public cua project ben thu 3.
- Production khong dung `localhost`.
- Payment service se POST callback ve URL nay khi order paid.

`reference_code`:

- Khong bat buoc.
- Neu gui, phai la 8-10 ky tu A-Z/0-9.
- Khong dau, khong khoang trang, khong ky tu dac biet.
- Neu sai format API tra `400`.
- Neu trung voi order cu API tra `409`.

### Response thanh cong

Status:

```http
201 Created
```

Body:

```json
{
  "order_id": "3c534ecb-0970-4619-9716-a67dc3f586a8",
  "status": "pending",
  "reference_code": "X9GUHMEJYV",
  "payment_description": "PSX9GUHMEJYV",
  "qr_code_url": "https://vietqr.app/img?acc=...&bank=...&amount=2000&des=PSX9GUHMEJYV"
}
```

Project ben thu 3 can luu it nhat:

```json
{
  "local_order_id": "order cua app ban",
  "payment_order_id": "3c534ecb-0970-4619-9716-a67dc3f586a8",
  "payment_status": "pending",
  "payment_reference_code": "X9GUHMEJYV",
  "payment_description": "PSX9GUHMEJYV"
}
```

### Response loi thuong gap

Thieu header hoac sai key:

```http
401 Unauthorized
```

```json
{
  "message": "Unauthorized"
}
```

Thieu field:

```http
400 Bad Request
```

```json
{
  "message": "amount, description, and callback_url are required"
}
```

Sai amount:

```http
400 Bad Request
```

```json
{
  "message": "amount must be a positive number"
}
```

Sai reference_code:

```http
400 Bad Request
```

```json
{
  "message": "reference_code must be 8-10 uppercase alphanumeric characters without spaces"
}
```

Trung reference_code:

```http
409 Conflict
```

```json
{
  "message": "reference_code or order_id already exists"
}
```

## API 2: Lay trang thai order

Dung de polling UI hoac fallback khi callback chua den.

### Request

```http
GET <PAYMENT_SERVICE_URL>/api/orders/<order_id>
x-client-id: <PAYMENT_CLIENT_ID>
x-api-key: <PAYMENT_API_KEY>
```

Vi du:

```http
GET https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net/api/orders/3c534ecb-0970-4619-9716-a67dc3f586a8
x-client-id: client_demo_1
x-api-key: demo_key_1_abc
```

### Response thanh cong

```json
{
  "order_id": "3c534ecb-0970-4619-9716-a67dc3f586a8",
  "client_id": "client_demo_1",
  "amount": 2000,
  "description": "Buy coffee",
  "reference_code": "X9GUHMEJYV",
  "callback_url": "https://your-shop.com/api/payment-callback",
  "status": "pending",
  "sepay_transaction_id": null,
  "created_at": "2026-07-06T08:09:55.664Z",
  "paid_at": null
}
```

Khi da thanh toan:

```json
{
  "order_id": "3c534ecb-0970-4619-9716-a67dc3f586a8",
  "client_id": "client_demo_1",
  "amount": 2000,
  "description": "Buy coffee",
  "reference_code": "X9GUHMEJYV",
  "callback_url": "https://your-shop.com/api/payment-callback",
  "status": "paid",
  "sepay_transaction_id": 123456,
  "created_at": "2026-07-06T08:09:55.664Z",
  "paid_at": "2026-07-06T08:15:01.123Z"
}
```

### Response loi

Sai client hoac order khong thuoc client hien tai:

```http
404 Not Found
```

```json
{
  "message": "Order not found"
}
```

Sai key:

```http
401 Unauthorized
```

```json
{
  "message": "Unauthorized"
}
```

## Callback tu payment service ve project ben thu 3

Project ben thu 3 phai tao endpoint public:

```http
POST <APP_PUBLIC_URL>/api/payment-callback
Content-Type: application/json
```

Payment service se gui body:

```json
{
  "order_id": "3c534ecb-0970-4619-9716-a67dc3f586a8",
  "status": "paid",
  "client_id": "client_demo_1"
}
```

Endpoint callback cua project ben thu 3 nen:

1. Nhan `order_id`, `status`, `client_id`.
2. Tim don hang local bang `payment_order_id == order_id`.
3. Kiem tra `client_id` dung voi client cua project.
4. Neu `status == "paid"` thi update don hang local sang paid.
5. Neu callback bi goi lai lan 2, xu ly idempotent: da paid roi thi tra success, khong tru kho/giao hang lan nua.
6. Tra response `200` nhanh.

Response khuyen nghi:

```json
{
  "success": true
}
```

Vi du Express:

```js
app.post('/api/payment-callback', express.json(), async (req, res) => {
  const { order_id, status, client_id } = req.body;

  if (!order_id || !status || !client_id) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const order = await Order.findOne({ payment_order_id: order_id });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (client_id !== process.env.PAYMENT_CLIENT_ID) {
    return res.status(403).json({ success: false, message: 'Invalid client_id' });
  }

  if (order.status === 'paid') {
    return res.json({ success: true });
  }

  if (status === 'paid') {
    order.status = 'paid';
    order.paid_at = new Date();
    await order.save();
  }

  return res.json({ success: true });
});
```

Luu y: hien tai payment service chua ky callback bang HMAC rieng.
Neu dung production nghiem tuc, nen bo sung callback signature giua payment service va app ben thu 3.

## Polling status

Nen co polling de cap nhat UI thanh toan, ke ca khi callback chua den hoac callback endpoint tam thoi loi.

Khuyen nghi:

- Sau khi tao order, polling moi 3-5 giay.
- Dung `GET /api/orders/:order_id`.
- Dung lai sau khi status la `paid`, `failed`, hoac qua timeout 10-15 phut.
- Callback van la nguon de complete order server-side; polling chu yeu de cap nhat UI.

Vi du:

```js
async function getPaymentStatus(orderId) {
  const response = await fetch(`${PAYMENT_SERVICE_URL}/api/orders/${orderId}`, {
    headers: {
      'x-client-id': PAYMENT_CLIENT_ID,
      'x-api-key': PAYMENT_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch payment status');
  }

  return response.json();
}
```

## Mau tich hop Node/Express

### Tao order tu app ben thu 3

```js
app.post('/api/checkout', express.json(), async (req, res, next) => {
  try {
    const { product_id } = req.body;
    const product = await Product.findById(product_id);

    if (!product) {
      return res.status(400).json({ message: 'Invalid product_id' });
    }

    const localOrder = await Order.create({
      product_id: product.id,
      amount: product.price,
      status: 'pending',
    });

    const paymentResponse = await fetch(`${process.env.PAYMENT_SERVICE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': process.env.PAYMENT_CLIENT_ID,
        'x-api-key': process.env.PAYMENT_API_KEY,
      },
      body: JSON.stringify({
        amount: product.price,
        description: `Order ${localOrder.id}`,
        callback_url: `${process.env.APP_PUBLIC_URL}/api/payment-callback`,
      }),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      localOrder.status = 'payment_create_failed';
      await localOrder.save();
      return res.status(paymentResponse.status).json(paymentData);
    }

    localOrder.payment_order_id = paymentData.order_id;
    localOrder.payment_reference_code = paymentData.reference_code;
    localOrder.payment_description = paymentData.payment_description;
    localOrder.payment_qr_code_url = paymentData.qr_code_url;
    await localOrder.save();

    return res.status(201).json({
      order_id: localOrder.id,
      payment_order_id: paymentData.order_id,
      status: localOrder.status,
      qr_code_url: paymentData.qr_code_url,
      payment_description: paymentData.payment_description,
    });
  } catch (error) {
    return next(error);
  }
});
```

### Callback complete order

```js
app.post('/api/payment-callback', express.json(), async (req, res, next) => {
  try {
    const { order_id, status, client_id } = req.body;

    if (client_id !== process.env.PAYMENT_CLIENT_ID) {
      return res.status(403).json({ success: false, message: 'Invalid client_id' });
    }

    const order = await Order.findOne({ payment_order_id: order_id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'paid') {
      return res.json({ success: true });
    }

    if (status === 'paid') {
      order.status = 'paid';
      order.paid_at = new Date();
      await order.save();
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
```

## CURL test nhanh

### Tao order

```bash
curl -X POST "https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net/api/orders" \
  -H "Content-Type: application/json" \
  -H "x-client-id: client_demo_1" \
  -H "x-api-key: demo_key_1_abc" \
  -d '{
    "amount": 2000,
    "description": "Test coffee order",
    "callback_url": "https://your-shop.com/api/payment-callback"
  }'
```

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net/api/orders" `
  -Headers @{
    "x-client-id" = "client_demo_1"
    "x-api-key" = "demo_key_1_abc"
  } `
  -ContentType "application/json" `
  -Body '{
    "amount": 2000,
    "description": "Test coffee order",
    "callback_url": "https://your-shop.com/api/payment-callback"
  }'
```

### Lay status

```bash
curl "https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net/api/orders/<order_id>" \
  -H "x-client-id: client_demo_1" \
  -H "x-api-key: demo_key_1_abc"
```

## Swagger

Swagger UI cua payment service:

```text
https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net/api-docs
```

Swagger chi document API cho client project:

- `POST /api/orders`
- `GET /api/orders/{order_id}`

Webhook SePay khong document trong Swagger vi endpoint do chi danh cho SePay goi.

## Checklist tich hop vao project khac

- [ ] Da co `PAYMENT_SERVICE_URL`.
- [ ] Da co `PAYMENT_CLIENT_ID`.
- [ ] Da co `PAYMENT_API_KEY`.
- [ ] Da co public app URL cho callback, vi du `APP_PUBLIC_URL=https://your-shop.com`.
- [ ] Khi checkout, app goi `POST /api/orders`.
- [ ] Request co header `x-client-id`.
- [ ] Request co header `x-api-key`.
- [ ] Body co `amount` la number, khong phai string.
- [ ] Body co `description`.
- [ ] Body co `callback_url` public.
- [ ] App luu `payment_order_id = response.order_id`.
- [ ] App hien thi `response.qr_code_url`.
- [ ] App hien thi `response.payment_description` neu can.
- [ ] App co endpoint callback `POST /api/payment-callback`.
- [ ] Callback handler idempotent, khong giao hang/tru kho 2 lan.
- [ ] App polling `GET /api/orders/:order_id` de cap nhat UI.
- [ ] Production khong dung `localhost` trong `callback_url`.

## Loi thuong gap

### Bam mua nhung 401 Unauthorized

Nguyen nhan:

- Sai `PAYMENT_CLIENT_ID`.
- Sai `PAYMENT_API_KEY`.
- Client chua duoc seed/tao trong database payment service.
- Header bi viet sai ten.

Dung header dung:

```http
x-client-id: client_demo_1
x-api-key: demo_key_1_abc
```

### QR tao duoc nhung thanh toan xong app van pending

Can phan biet:

1. Payment service da paid chua?
   Goi `GET /api/orders/:order_id`.

2. Neu payment service van `pending`:
   - SePay webhook chua goi duoc payment service.
   - Noi dung chuyen khoan khong co dung `payment_description`.
   - So tien chuyen nho hon `amount`.
   - Webhook secret/HMAC sai.

3. Neu payment service da `paid` nhung app van pending:
   - Callback ve app bi fail.
   - `callback_url` dang la `localhost`.
   - App callback endpoint loi.
   - App khong luu `payment_order_id` nen khong match duoc order local.

### Dung localhost co callback duoc khong?

Neu payment service dang chay public/Azure thi khong.
Azure goi `http://localhost:3001` se la localhost cua Azure, khong phai may dev.

Muon test callback local thi dung ngrok/cloudflared:

```bash
ngrok http 3001
```

Sau do dat:

```env
APP_PUBLIC_URL=https://your-ngrok-url.ngrok-free.app
```

### Co can deploy app ben thu 3 khong?

Production hoan chinh thi co.
App ben thu 3 can public URL de payment service callback.

Neu chua deploy, van co the test tao order va polling status, nhung callback tu Azure ve local se khong chay.

### Co nen tu tao reference_code trong app ben thu 3 khong?

Thuong la khong.
Hay de payment service tu sinh de tranh sai format/trung ma.

### Co nen tin callback 100% khong?

Nen update theo callback, nhung callback handler phai idempotent.
Voi he thong quan trong, sau khi nhan callback co the goi lai `GET /api/orders/:order_id` de verify status tren payment service truoc khi giao hang.

## Security notes

Hien tai:

- Project ben thu 3 -> payment service: bao mat bang `x-client-id` va `x-api-key`.
- SePay -> payment service: bao mat bang HMAC-SHA256.
- Payment service -> project ben thu 3 callback: hien chua co HMAC rieng.

Khuyen nghi production:

- Dung HTTPS bat buoc.
- Khong hardcode api key trong frontend/browser.
- Chi goi payment service tu backend cua project ben thu 3.
- Luu `PAYMENT_API_KEY` trong server env.
- Them callback signature giua payment service va project ben thu 3 neu callback co tac dong quan trong.
- Callback handler phai idempotent.

## Dieu khong nen lam

- Khong goi `POST /api/orders` truc tiep tu frontend neu api key bi lo ra browser.
- Khong dung `localhost` lam `callback_url` production.
- Khong sua `payment_description` truoc khi hien thi cho user.
- Khong coi order local la paid chi vi da tao QR.
- Khong giao hang/tru kho nhieu lan neu callback bi goi lai.
- Khong bo qua check `client_id` trong callback handler.

