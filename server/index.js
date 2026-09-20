import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isProduction = process.env.NODE_ENV === 'production';

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

// Local:
//   project/data
//   project/uploads
//
// Vercel:
//   /tmp/ledgerly/data
//   /tmp/ledgerly/uploads
const storageRoot = isProduction
  ? '/tmp/ledgerly'
  : root;

const dataDirectory = path.join(storageRoot, 'data');
const uploadsDirectory = path.join(storageRoot, 'uploads');
const databaseFile = path.join(dataDirectory, 'invoices.json');

await fs.mkdir(dataDirectory, { recursive: true });
await fs.mkdir(uploadsDirectory, { recursive: true });

try {
  await fs.access(databaseFile);
} catch {
  await fs.writeFile(databaseFile, '[]', 'utf8');
}

const categories = [
  'Food',
  'Fun',
  'Daily items',
  'Essentials'
];

const storage = multer.diskStorage({
  destination: uploadsDirectory,

  filename: (_req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${nanoid(8)}${path
        .extname(file.originalname)
        .toLowerCase()}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    cb(
      null,
      [
        'application/pdf',
        'image/jpeg',
        'image/png'
      ].includes(file.mimetype)
    );
  }
});

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/uploads',
  express.static(uploadsDirectory)
);

const read = async () => {
  const content = await fs.readFile(
    databaseFile,
    'utf8'
  );

  return JSON.parse(content);
};

const save = async (invoices) => {
  await fs.writeFile(
    databaseFile,
    JSON.stringify(invoices, null, 2),
    'utf8'
  );
};

const categorize = (name = '') => {
  const s = name.toLowerCase();

  if (
    /(cafe|coffee|restaurant|pizza|grocery|market|food|dining)/.test(s)
  ) {
    return 'Food';
  }

  if (
    /(movie|concert|game|theater|music|fun|stream)/.test(s)
  ) {
    return 'Fun';
  }

  if (
    /(pharmacy|utility|rent|insurance|medical|essential|fuel)/.test(s)
  ) {
    return 'Essentials';
  }

  return 'Daily items';
};

app.get('/api/invoices', async (_req, res) => {
  try {
    const invoices = await read();
    res.json(invoices);
  } catch (error) {
    console.error('Failed to read invoices:', error);

    res.status(500).json({
      error: 'Failed to load invoices.'
    });
  }
});

app.get('/api/summary', async (_req, res) => {
  try {
    const invoices = await read();

    const totals = Object.fromEntries(
      categories.map((c) => [c, 0])
    );

    invoices.forEach((invoice) => {
      if (totals[invoice.category] !== undefined) {
        totals[invoice.category] += Number(invoice.amount);
      }
    });

    res.json({
      count: invoices.length,
      total: Object.values(totals).reduce(
        (a, b) => a + b,
        0
      ),
      totals
    });
  } catch (error) {
    console.error('Failed to create summary:', error);

    res.status(500).json({
      error: 'Failed to load summary.'
    });
  }
});

app.post(
  '/api/invoices',
  upload.single('invoice'),
  async (req, res) => {
    try {
      const {
        merchant,
        amount,
        date,
        category
      } = req.body;

      if (
        !merchant?.trim() ||
        !Number(amount) ||
        !date
      ) {
        return res.status(400).json({
          error:
            'Merchant, amount, and date are required.'
        });
      }

      if (
        category &&
        !categories.includes(category)
      ) {
        return res.status(400).json({
          error: 'Invalid category.'
        });
      }

      const invoice = {
        id: nanoid(12),

        merchant: merchant.trim(),

        amount: Number(amount),

        date,

        category:
          category ||
          categorize(
            `${merchant} ${
              req.file?.originalname || ''
            }`
          ),

        fileName:
          req.file?.originalname || null,

        fileUrl: req.file
          ? `/uploads/${req.file.filename}`
          : null,

        createdAt:
          new Date().toISOString()
      };

      const invoices = await read();

      invoices.push(invoice);

      await save(invoices);

      res.status(201).json(invoice);
    } catch (error) {
      console.error(
        'Failed to create invoice:',
        error
      );

      res.status(500).json({
        error: 'Failed to save invoice.'
      });
    }
  }
);

app.delete(
  '/api/invoices/:id',
  async (req, res) => {
    try {
      const invoices = await read();

      const item = invoices.find(
        (invoice) =>
          invoice.id === req.params.id
      );

      if (!item) {
        return res.sendStatus(404);
      }

      await save(
        invoices.filter(
          (invoice) =>
            invoice.id !== item.id
        )
      );

      if (item.fileUrl) {
        await fs
          .unlink(
            path.join(
              uploadsDirectory,
              path.basename(item.fileUrl)
            )
          )
          .catch(() => {});
      }

      res.sendStatus(204);
    } catch (error) {
      console.error(
        'Failed to delete invoice:',
        error
      );

      res.status(500).json({
        error: 'Failed to delete invoice.'
      });
    }
  }
);

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error('Upload error:', error);

    if (
      error instanceof multer.MulterError
    ) {
      return res.status(400).json({
        error:
          'Invoice must be 10 MB or smaller.'
      });
    }

    res.status(400).json({
      error:
        'Upload a PDF, JPEG, or PNG invoice.'
    });
  }
);

export default app;

if (!isProduction) {
  app.listen(3001, () => {
    console.log(
      'Ledgerly API running at http://localhost:3001'
    );
  });
}