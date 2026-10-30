import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'revenant_db';
const LOCAL_STORE_PATH = path.join(process.cwd(), '.revenant_local_store.json');

let client = null;
let db = null;
let isConnected = false;

// Comprehensive 16-Sin Graveyard of Canonical Competitive Programming Mistakes
export const SEED_CATEGORIES = [
  {
    key: 'int_overflow',
    name: '32-bit Integer Overflow',
    description: 'Using 32-bit int for accumulators, prefix sums, or counts that exceed 2*10^9',
    count: 1,
    weakness: 2.5,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'int_multiplication_overflow',
    name: '32-bit Multiplication Overflow',
    description: 'Computing a * b with 32-bit ints before assigning to long long (missing 1LL * a * b)',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'off_by_one_index',
    name: '0-based vs 1-based Index Off-By-One',
    description: 'Querying 1-based graph or tree nodes in a 0-indexed array, or boundary condition loops (<= vs <)',
    count: 1,
    weakness: 2.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'unreset_global_state',
    name: 'Unreset Global State Across Test Cases',
    description: 'Failing to clear adjacency lists, visited arrays, or memo tables inside while(t--) loops',
    count: 1,
    weakness: 2.2,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'modulo_arithmetic_negative',
    name: 'Negative Modulo Handling',
    description: 'Taking (a - b) % MOD without adding MOD, yielding negative residues',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'modulo_missing_intermediate',
    name: 'Missing Modulo in Intermediate Steps',
    description: 'Forgetting to take % MOD during intermediate loop additions or multiplications',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'precision_loss_float',
    name: 'Floating Point Precision Loss',
    description: 'Direct == comparison of double/float or using float where long double / epsilon (1e-9) is required',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'infinite_loop_condition',
    name: 'Binary Search or Loop Stagnation',
    description: 'Loop condition not progressing (e.g. low = mid without mid + 1 in binary search)',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'uninitialized_variable',
    name: 'Uninitialized Local Variable',
    description: 'Declaring local variables without initial zero value, reading garbage stack memory',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'array_bounds_out_of_range',
    name: 'Out of Bounds Array Access',
    description: 'Reading negative indices in DP table or index >= size of array',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'stack_overflow_recursion',
    name: 'Recursion Depth Stack Overflow',
    description: 'Deep recursive DFS on large trees (depth > 10^5) blowing default stack limit',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'multiset_erase_all',
    name: 'Multiset Erase All Copies',
    description: 'Calling ms.erase(val) which removes all instances instead of ms.erase(ms.find(val))',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'sorting_comparator_invalid',
    name: 'Strict Weak Ordering Violation',
    description: 'Custom sort comparator returning true on equality (must use <, never <=)',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'graph_directed_vs_undirected',
    name: 'Missing Bidirectional Graph Edge',
    description: 'Only adding adj[u].push_back(v) when problem statement specifies undirected graph',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'fast_io_endl',
    name: 'Slow I/O with std::endl',
    description: 'Using std::endl instead of \\n causing repetitive buffer flushes and TLE in large outputs',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  },
  {
    key: 'priority_queue_ordering',
    name: 'Inverted Priority Queue Comparator',
    description: 'Expecting min-heap with default priority_queue<T> (default is max-heap)',
    count: 0,
    weakness: 1.0,
    lastSeen: new Date().toISOString(),
    status: 'active'
  }
];

export function getLocalStore() {
  if (fs.existsSync(LOCAL_STORE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));
      const existingKeys = new Set((data.categories || []).map(c => c.key));
      for (const seed of SEED_CATEGORIES) {
        if (!existingKeys.has(seed.key)) {
          data.categories.push(seed);
        }
      }
      return data;
    } catch (e) {
      // Fallback
    }
  }
  return {
    failures: [],
    categories: [...SEED_CATEGORIES],
    runs: []
  };
}

export function saveLocalStore(store) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    // Ignore local save errors
  }
}

/**
 * Connects to MongoDB Atlas if MONGODB_URI is provided.
 */
export async function connectDb() {
  if (isConnected && db) return db;

  if (!MONGODB_URI) {
    return null;
  }

  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    await client.connect();
    db = client.db(DB_NAME);
    isConnected = true;

    // Seed missing categories into MongoDB
    const catCollection = db.collection('categories');
    for (const seed of SEED_CATEGORIES) {
      await catCollection.updateOne(
        { key: seed.key },
        { $setOnInsert: seed },
        { upsert: true }
      );
    }

    return db;
  } catch (err) {
    db = null;
    isConnected = false;
    return null;
  }
}

/**
 * Returns active categories ordered by weakness descending (The Quick-Guess Cache).
 */
export async function getTopCategories(limit = 7) {
  const database = await connectDb();
  if (database) {
    try {
      return await database.collection('categories')
        .find({ status: 'active', weakness: { $gte: 0.5 } })
        .sort({ weakness: -1 })
        .limit(limit)
        .toArray();
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  return (store.categories || [])
    .filter(c => c.status === 'active' && (c.weakness || 0) >= 0.5)
    .sort((a, b) => (b.weakness || 0) - (a.weakness || 0))
    .slice(0, limit);
}

/**
 * Returns ALL categories in the Graveyard (active + exorcised) for LLM classification.
 */
export async function getAllCategories() {
  const database = await connectDb();
  if (database) {
    try {
      return await database.collection('categories').find({}).toArray();
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  return store.categories || SEED_CATEGORIES;
}

/**
 * Retrieves all uncategorized failures for clustering during a séance.
 */
export async function getUncategorizedFailures() {
  const database = await connectDb();
  if (database) {
    try {
      return await database.collection('failures')
        .find({ category: 'uncategorized' })
        .toArray();
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  return (store.failures || []).filter(f => f.category === 'uncategorized');
}

/**
 * Saves a validated new category into MongoDB categories collection.
 */
export async function saveNewCategory(categoryDoc) {
  const database = await connectDb();
  if (database) {
    try {
      await database.collection('categories').updateOne(
        { key: categoryDoc.key },
        { $set: categoryDoc },
        { upsert: true }
      );
      return categoryDoc;
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  const idx = store.categories.findIndex(c => c.key === categoryDoc.key);
  if (idx >= 0) {
    store.categories[idx] = categoryDoc;
  } else {
    store.categories.push(categoryDoc);
  }
  saveLocalStore(store);
  return categoryDoc;
}

/**
 * Links clustered failures to the newly minted category.
 */
export async function linkFailuresToCategory(failureFiles = [], newCategoryKey) {
  const database = await connectDb();
  if (database) {
    try {
      await database.collection('failures').updateMany(
        { file: { $in: failureFiles }, category: 'uncategorized' },
        { $set: { category: newCategoryKey } }
      );
      return;
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  const fileSet = new Set(failureFiles);
  for (const f of store.failures) {
    if (fileSet.has(f.file) && f.category === 'uncategorized') {
      f.category = newCategoryKey;
    }
  }
  saveLocalStore(store);
}

/**
 * Records a failure snapshot into MongoDB and updates weakness.
 */
export async function recordFailure(failureDoc) {
  const doc = {
    ...failureDoc,
    timestamp: new Date().toISOString()
  };

  const database = await connectDb();
  if (database) {
    try {
      await database.collection('failures').insertOne(doc);
      if (doc.category && doc.category !== 'uncategorized') {
        await updateCategoryWeakness(doc.category);
      }
      return doc;
    } catch (err) {
      // Fallback
    }
  }

  const store = getLocalStore();
  store.failures.push(doc);
  if (doc.category && doc.category !== 'uncategorized') {
    const cat = store.categories.find(c => c.key === doc.category);
    if (cat) {
      const daysPassed = (Date.now() - new Date(cat.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
      cat.weakness = (cat.weakness || 1.0) * Math.pow(0.5, daysPassed / 14) + 1;
      cat.count = (cat.count || 0) + 1;
      cat.lastSeen = new Date().toISOString();
      cat.status = 'active';
    }
  }
  saveLocalStore(store);
  return doc;
}

/**
 * Updates weakness score using half-life decay formula:
 * weakness = weakness * 0.5^(days / 14) + 1
 */
export async function updateCategoryWeakness(categoryKey) {
  const database = await connectDb();
  if (!database) return;

  const cat = await database.collection('categories').findOne({ key: categoryKey });
  if (!cat) return;

  const lastSeen = cat.lastSeen ? new Date(cat.lastSeen) : new Date();
  const daysPassed = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
  const newWeakness = (cat.weakness || 1.0) * Math.pow(0.5, daysPassed / 14) + 1;

  await database.collection('categories').updateOne(
    { key: categoryKey },
    {
      $set: {
        weakness: Number(newWeakness.toFixed(3)),
        lastSeen: new Date().toISOString(),
        status: 'active'
      },
      $inc: { count: 1 }
    }
  );
}

export async function closeDb() {
  if (client) {
    await client.close();
    isConnected = false;
  }
}
