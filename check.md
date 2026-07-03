# 🔒 Web Security Testing Checklist
## Node.js + PostgreSQL + React Stack

**Mục đích**: Agent tự động test toàn bộ các lỗ hổng bảo mật phổ biến.
**Stack**: Node.js (Backend), PostgreSQL (Database), React (Frontend)

---

## 📋 PHẦN 1: BACKEND SECURITY (Node.js/Express)

### 1.1 SQL Injection

**Kiểm tra**: Các endpoint query database có tránh SQL Injection?

```bash
# Test 1: Basic SQL Injection
curl -X POST http://localhost:3000/api/users/search \
  -H "Content-Type: application/json" \
  -d '{"username": "admin'\'' OR ''1''=''1"}'

# Test 2: Login bypass
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin'\'' --", "password": "anything"}'

# Test 3: Database info leak
curl -X GET "http://localhost:3000/api/users?id=1 UNION SELECT 1,2,3"

# Expected: Queries phải dùng Prepared Statements
# ✅ GOOD: db.query('SELECT * FROM users WHERE id = $1', [id])
# ❌ BAD: db.query(`SELECT * FROM users WHERE id = ${id}`)
```

**Code review**:
```javascript
// ❌ VULNERABLE
app.get('/users/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, result) => { /* ... */ });
});

// ✅ SAFE
app.get('/users/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = $1';
  db.query(query, [req.params.id], (err, result) => { /* ... */ });
});
```

---

### 1.2 XSS (Cross-Site Scripting)

**Kiểm tra**: Response có escape HTML/JavaScript không?

```bash
# Test 1: Stored XSS - Post comment
curl -X POST http://localhost:3000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>alert('\''XSS'\'')</script>", "postId": 1}'

# Check response
curl -X GET http://localhost:3000/api/comments/1

# Test 2: Reflected XSS
curl "http://localhost:3000/search?q=<img src=x onerror=alert(1)>"

# Expected: Script tags phải bị escape
# ✅ &lt;script&gt; hoặc encoding
```

**Code review**:
```javascript
// ❌ VULNERABLE - React
function Comment({ text }) {
  return <div dangerouslySetInnerHTML={{__html: text}} />;
}

// ✅ SAFE - React (default)
function Comment({ text }) {
  return <div>{text}</div>; // React auto-escapes
}

// Backend
// ❌ VULNERABLE
res.send(`<p>${userInput}</p>`);

// ✅ SAFE (use templating engine with auto-escape)
res.render('template', { userInput }); // Pug/EJS auto-escape
```

---

### 1.3 CSRF (Cross-Site Request Forgery)

**Kiểm tra**: POST/PUT/DELETE có CSRF token không?

```bash
# Test: POST without CSRF token từ domain khác
curl -X POST http://localhost:3000/api/users/delete/1 \
  -H "Origin: http://attacker.com" \
  -H "Content-Type: application/json" \
  -d '{"id": 1}'

# Expected: 403 Forbidden hoặc require CSRF token
```

**Code review**:
```javascript
// ✅ SAFE - dùng csrf middleware
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.post('/api/users/delete', csrfProtection, (req, res) => {
  // xác thực CSRF token từ request
  res.json({ deleted: true });
});

// Frontend (React)
const [csrfToken, setCsrfToken] = useState('');

useEffect(() => {
  fetch('/api/csrf-token').then(r => r.json()).then(d => setCsrfToken(d.token));
}, []);

function deleteUser(id) {
  fetch(`/api/users/delete/${id}`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken }
  });
}
```

---

### 1.4 Authentication & Authorization

**Kiểm tra**: Login/logout có secure? JWT/session có valid?

```bash
# Test 1: Weak password
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "123"}'
# Expected: Reject (min 8 char, complexity required)

# Test 2: Token expiration
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}' | jq -r .token)
sleep 3600 # chờ token expire
curl -X GET http://localhost:3000/api/profile \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401 Unauthorized

# Test 3: Token không có signature
curl -X GET http://localhost:3000/api/profile \
  -H "Authorization: Bearer eyJhbGciOiJub25lIn0..."
# Expected: 401 Reject

# Test 4: Privilege escalation
curl -X PATCH http://localhost:3000/api/users/2/role \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
# Expected: 403 Forbidden (không thể change role người khác)
```

**Code review**:
```javascript
// ✅ SAFE JWT setup
const jwt = require('jsonwebtoken');

app.post('/api/login', (req, res) => {
  // validate password hash
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // ⭐ set expiration
  );
  res.json({ token });
});

// Middleware verify
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Check authorization
app.get('/api/users/:id', verifyToken, (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ...
});
```

---

### 1.5 Input Validation & Sanitization

**Kiểm tra**: Mọi input có validate type, length, format?

```bash
# Test 1: Oversized input
curl -X POST http://localhost:3000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"text": "'$(printf 'a%.0s' {1..100000})'"}'
# Expected: 413 Payload Too Large hoặc reject

# Test 2: Invalid email
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email", "password": "Pass123!"}'
# Expected: 400 Bad Request

# Test 3: Unexpected field types
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"age": "abc", "username": 123}'
# Expected: 400 Bad Request
```

**Code review**:
```javascript
// ✅ SAFE - dùng express-validator
const { body, validationResult } = require('express-validator');

app.post('/api/users',
  body('email').isEmail().trim().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  body('age').isInt({ min: 0, max: 150 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // process...
  }
);
```

---

### 1.6 Security Headers

**Kiểm tra**: Response headers có content security không?

```bash
# Test: Check response headers
curl -I http://localhost:3000/

# Expected headers:
# Content-Security-Policy: default-src 'self'
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000
# X-XSS-Protection: 1; mode=block
```

**Code review**:
```javascript
// ✅ SAFE - dùng helmet
const helmet = require('helmet');
app.use(helmet()); // sets all security headers

// Custom
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

---

### 1.7 Rate Limiting & DoS Protection

**Kiểm tra**: API có rate limit không?

```bash
# Test: Brute force login
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "wrong'$i'"}'
done

# Expected: 429 Too Many Requests sau request nào đó
```

**Code review**:
```javascript
// ✅ SAFE - dùng express-rate-limit
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 requests/IP
  message: 'Quá nhiều login attempts'
});

app.post('/api/login', loginLimiter, (req, res) => {
  // ...
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100 // 100 requests/IP
});

app.use('/api/', apiLimiter);
```

---

### 1.8 Sensitive Data Exposure

**Kiểm tra**: Không log/expose passwords, tokens, credit cards?

```bash
# Test: Check error messages
curl -X GET http://localhost:3000/api/users/999

# Bad response: {"error": "User with id 999 not found in SELECT * FROM users"}
# Good response: {"error": "User not found"}

# Test: Check logs
tail -f logs/app.log | grep -i "password\|token\|secret"
# Should find NOTHING
```

**Code review**:
```javascript
// ❌ VULNERABLE
console.log('User:', user); // logs password hash?
res.json(user); // returns sensitive fields?

// ✅ SAFE
const { password, ...safeUser } = user;
console.log('User created:', safeUser.id);
res.json(safeUser);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack); // log internally
  res.status(500).json({ 
    error: 'Internal server error' // don't expose details
  });
});
```

---

## 📋 PHẦN 2: DATABASE SECURITY (PostgreSQL)

### 2.1 Database Access Control

**Kiểm tra**: User database có lowest privilege?

```bash
# Test: Check user permissions
psql -U postgres -d your_db -c "\du"

# Expected: App user chỉ có SELECT, INSERT, UPDATE, DELETE trên specific tables
# KHÔNG có SUPERUSER, CREATE DATABASE, v.v.

# Create restricted user
psql -U postgres << EOF
CREATE USER app_user WITH PASSWORD 'secure_password_123';
GRANT CONNECT ON DATABASE your_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
EOF
```

---

### 2.2 Password Management

**Kiểm tra**: User passwords stored securely?

```javascript
// ✅ SAFE - hash passwords
const bcrypt = require('bcrypt');

// Register
app.post('/api/register', async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  await db.query(
    'INSERT INTO users (email, password) VALUES ($1, $2)',
    [req.body.email, hashedPassword]
  );
});

// Login
app.post('/api/login', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
  const isValid = await bcrypt.compare(req.body.password, user.password);
  if (!isValid) return res.status(401).json({ error: 'Invalid' });
  // ...
});
```

---

### 2.3 SQL Injection Prevention

**Kiểm tra**: Verify all queries use parameterized queries

```bash
# Grep code
grep -r "db.query\(" app/ | grep -v "\$[0-9]"

# Expected: ALL queries dùng $1, $2, ... parameters
# ❌ BAD: db.query(`SELECT * FROM users WHERE id = ${id}`)
# ✅ GOOD: db.query('SELECT * FROM users WHERE id = $1', [id])
```

---

### 2.4 Backup & Recovery

**Kiểm tra**: Database có backup regularly?

```bash
# Test: Backup creation
pg_dump -U app_user your_db > backup_$(date +%Y%m%d).sql

# Test: Restore from backup
psql -U postgres -d test_db < backup_20240101.sql

# Expected: Regular automated backups (cron job)
# Encrypt backups: openssl enc -aes-256-cbc -in backup.sql -out backup.sql.enc
```

---

## 📋 PHẦN 3: FRONTEND SECURITY (React)

### 3.1 XSS Prevention

**Kiểm tra**: React dùng safe methods mà không escape?

```javascript
// ❌ VULNERABLE
function UserProfile({ bio }) {
  return <div dangerouslySetInnerHTML={{__html: bio}} />;
}

// ✅ SAFE
function UserProfile({ bio }) {
  return <div>{bio}</div>; // Auto-escaped by React
}

// ✅ If HTML needed, sanitize
import DOMPurify from 'dompurify';

function UserProfile({ bio }) {
  return <div>{DOMPurify.sanitize(bio)}</div>;
}
```

**Test**:
```bash
# Create user with XSS payload
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "bio": "<img src=x onerror=alert(1)>"}'

# Check frontend - should NOT execute script
```

---

### 3.2 CSRF Protection in React

**Kiểm tra**: POST/PUT/DELETE requests có CSRF token?

```javascript
// ✅ SAFE
function useApi() {
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf-token')
      .then(r => r.json())
      .then(d => setCsrfToken(d.token));
  }, []);

  const post = (url, data) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken // ⭐ CSRF token
      },
      body: JSON.stringify(data)
    });
  };

  return { post };
}
```

---

### 3.3 Secure Storage (localStorage/sessionStorage)

**Kiểm tra**: JWT tokens không lưu localStorage (XSS risk)

```javascript
// ❌ VULNERABLE - dễ bị XSS lấy token
localStorage.setItem('token', jwtToken);

// ✅ SAFE - httpOnly cookie (set từ backend)
// Backend:
res.cookie('token', jwtToken, {
  httpOnly: true, // ⭐ không access từ JavaScript
  secure: true,   // HTTPS only
  sameSite: 'Strict' // CSRF protection
});

// Frontend - không cần lưu, browser tự gửi
fetch('/api/profile') // token in httpOnly cookie tự gửi
```

---

### 3.4 Environment Variables

**Kiểm tra**: API keys/URLs không hardcoded?

```javascript
// ❌ VULNERABLE
const API_KEY = 'sk_live_123456...';
const API_URL = 'https://api.production.com';

// ✅ SAFE
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// .env.local (gitignore)
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_LOG_LEVEL=debug

// Vào .gitignore:
# echo .env.local >> .gitignore
```

---

### 3.5 Dependency Vulnerabilities

**Kiểm tra**: npm packages có vulnerabilities?

```bash
# Scan
npm audit

# Fix
npm audit fix

# Install security plugin
npm install -g npm-check-updates
npm-check-updates -u

# Use lock file
# ✅ commit package-lock.json
# ❌ don't commit node_modules
```

---

## 📋 PHẦN 4: API SECURITY

### 4.1 HTTPS/TLS

**Kiểm tra**: Production dùng HTTPS?

```bash
# Test
curl -I https://your-domain.com/

# Expected: HTTP status 200 (not redirect)
# Check certificate
openssl s_client -connect your-domain.com:443 -tls1_2
```

**Code review - Development**:
```javascript
// Local HTTPS (dev)
const fs = require('fs');
const https = require('https');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000);
```

---

### 4.2 API Versioning

**Kiểm tra**: API route có version?

```bash
# ✅ GOOD
GET /api/v1/users
GET /api/v2/users

# ❌ BAD
GET /api/users (không version, breaking changes)
```

---

### 4.3 API Response Size

**Kiểm tra**: Response không quá lớn?

```bash
# Test: Pagination
curl "http://localhost:3000/api/users?limit=1000000"

# Expected: Max limit 100, default 20
```

**Code**:
```javascript
app.get('/api/users', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // max 100
  const offset = Math.min(parseInt(req.query.offset) || 0, 10000);
  // ...
});
```

---

## 📋 PHẦN 5: DEPLOYMENT SECURITY

### 5.1 Environment Variables

**Kiểm tra**: Secrets không commit to git

```bash
# Check history
git log --all --full-history -- .env
git log --all --oneline | grep -i "secret\|password\|token"

# If leaked:
git filter-branch --tree-filter 'rm -f .env' HEAD
```

---

### 5.2 Docker Security

**Kiểm tra**: Image dùng non-root user?

```dockerfile
# ❌ VULNERABLE
FROM node:18
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "start"]
# ⭐ Chạy as root

# ✅ SAFE
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN useradd -m appuser
USER appuser
EXPOSE 3000
CMD ["npm", "start"]
```

---

### 5.3 Logging & Monitoring

**Kiểm tra**: Logs không contain sensitive data?

```bash
# Grep logs
grep -r "password\|token\|secret\|credit\|ssn" logs/

# Expected: Nothing found
```

**Code**:
```javascript
// ✅ SAFE - mask sensitive data
function logSafeUser(user) {
  return {
    id: user.id,
    email: user.email.substring(0, 3) + '***@***',
    // không log password
  };
}

app.use((req, res, next) => {
  const safeReq = {
    method: req.method,
    path: req.path,
    // không log body nếu contain sensitive data
  };
  console.log(safeReq);
  next();
});
```

---

## 📋 PHẦN 6: COMPREHENSIVE TEST SCRIPT

**Chạy automated tests**:

```bash
#!/bin/bash
# security-test.sh

echo "🔒 Starting Security Tests..."

# Check Node version
node -v

# 1. Dependencies check
echo "\n[1] Scanning npm vulnerabilities..."
npm audit

# 2. Code analysis
echo "\n[2] Running ESLint security scan..."
npm run lint 2>/dev/null || echo "No lint configured"

# 3. SQL Injection test
echo "\n[3] Testing SQL Injection prevention..."
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test'"'"' OR 1=1 --", "password": "x"}' \
  | grep -q "Unauthorized\|Invalid" && echo "✅ SQL Injection protected" || echo "⚠️ Check SQL Injection"

# 4. XSS test
echo "\n[4] Testing XSS prevention..."
curl -s -X POST http://localhost:3000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>alert(1)</script>"}' | grep -q "script" && echo "⚠️ XSS risk" || echo "✅ XSS protected"

# 5. Rate limiting test
echo "\n[5] Testing Rate Limiting..."
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username": "test", "password": "x"}' > /dev/null
done
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "x"}' | grep -q "429\|Too Many" && echo "✅ Rate limiting works" || echo "⚠️ Check rate limiting"

# 6. HTTPS check
echo "\n[6] Checking HTTPS headers..."
curl -s -I http://localhost:3000/ | grep -E "Content-Security-Policy|X-Frame-Options|X-Content-Type-Options" && echo "✅ Security headers present" || echo "⚠️ Missing security headers"

# 7. Database check
echo "\n[7] Checking database security..."
psql -U postgres -d your_db -c "SELECT usename, usesuper FROM pg_user;" 2>/dev/null && echo "✅ Database check done" || echo "⚠️ Database check skipped"

echo "\n✅ Security test complete!"
```

**Chạy**:
```bash
chmod +x security-test.sh
./security-test.sh
```

---

## ✅ CHECKLIST TỔNG HỢP

- [ ] SQL Injection - dùng prepared statements
- [ ] XSS - React auto-escape, backend template engine
- [ ] CSRF - CSRF token trên POST/PUT/DELETE
- [ ] Authentication - JWT with expiration hoặc secure session
- [ ] Authorization - check user role trên sensitive endpoints
- [ ] Input validation - type, length, format validation
- [ ] Security headers - helmet.js hoặc manual headers
- [ ] Rate limiting - express-rate-limit
- [ ] Password hashing - bcrypt
- [ ] Sensitive data - không log passwords, use httpOnly cookies
- [ ] HTTPS - production chạy HTTPS
- [ ] Dependencies - npm audit, keep updated
- [ ] Environment - .env không commit
- [ ] Backup - database backup regular
- [ ] Logging - không log sensitive data
- [ ] Error handling - custom error messages (don't expose stack)

---

## 🚀 QUICK START

```bash
# 1. Install dependencies
npm install helmet express-rate-limit express-validator bcrypt jsonwebtoken

# 2. Apply helmet
const helmet = require('helmet');
app.use(helmet());

# 3. Add rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

# 4. Add input validation
const { body, validationResult } = require('express-validator');
// Use in routes as shown in section 1.5

# 5. Use bcrypt for passwords
const bcrypt = require('bcrypt');
// See section 2.2

# 6. Implement CSRF (backend)
const csrf = require('csurf');
app.use(csrf({ cookie: true }));

# 7. Check database user permissions
# See section 2.1
```

---

**Last Updated**: 2024
**For Agent Execution**: Follow each section in order, test endpoints with curl, verify code patterns