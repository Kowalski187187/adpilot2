const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  id: {
    type: String,
    enum: ['A', 'B'],
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  creative: {
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    imageUrl: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(v);
        },
        message: props => `${props.value} is not a valid URL!`
      }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'completed'],
    default: 'pending'
  },
  adIds: {
    facebook: String,
    google: String
  }
});

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  variants: [variantSchema],
  budgetPerDay: {
    type: Number,
    required: true,
    min: [0, 'Budget cannot be negative'],
    validate: {
      validator: Number.isFinite,
      message: 'Budget must be a finite number'
    }
  },
  durationDays: {
    type: Number,
    required: true,
    min: [1, 'Duration must be at least 1 day'],
    max: [90, 'Duration cannot exceed 90 days'],
    validate: {
      validator: Number.isInteger,
      message: 'Duration must be an integer'
    }
  },
  channels: [{
    type: String,
    enum: ['facebook', 'google'],
    required: true
  }],
  targeting: {
    locations: [String],
    ageRange: {
      min: {
        type: Number,
        min: 13,
        max: 65
      },
      max: {
        type: Number,
        min: 13,
        max: 65
      }
    },
    interests: [String]
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'paused'],
    default: 'pending',
    index: true
  },
  results: {
    spendA: {
      type: Number,
      default: 0,
      min: 0
    },
    revenueA: {
      type: Number,
      default: 0,
      min: 0
    },
    roasA: {
      type: Number,
      default: 0,
      min: 0
    },
    impressionsA: {
      type: Number,
      default: 0,
      min: 0
    },
    conversionsA: {
      type: Number,
      default: 0,
      min: 0
    },
    spendB: {
      type: Number,
      default: 0,
      min: 0
    },
    revenueB: {
      type: Number,
      default: 0,
      min: 0
    },
    roasB: {
      type: Number,
      default: 0,
      min: 0
    },
    impressionsB: {
      type: Number,
      default: 0,
      min: 0
    },
    conversionsB: {
      type: Number,
      default: 0,
      min: 0
    },
    winner: {
      type: String,
      enum: ['A', 'B', null],
      default: null
    },
    evaluationResults: {
      roasImprovement: {
        value: Number,
        threshold: Number,
        passed: Boolean
      },
      statisticalSignificance: {
        value: Number,
        threshold: Number,
        passed: Boolean
      },
      confidenceInterval: {
        value: Number,
        threshold: Number,
        passed: Boolean
      },
      sampleSize: {
        value: Number,
        threshold: Number,
        passed: Boolean
      },
      lastEvaluated: Date
    }
  },
  startDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  endDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound index for efficient querying
campaignSchema.index({ status: 1, startDate: 1 });

// Update timestamps
campaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Add method to calculate total spend
campaignSchema.methods.getTotalSpend = function() {
  return this.results.spendA + this.results.spendB;
};

// Add method to calculate total revenue
campaignSchema.methods.getTotalRevenue = function() {
  return this.results.revenueA + this.results.revenueB;
};

// Add method to calculate overall ROAS
campaignSchema.methods.getOverallROAS = function() {
  const totalSpend = this.getTotalSpend();
  return totalSpend > 0 ? this.getTotalRevenue() / totalSpend : 0;
};

module.exports = mongoose.model('Campaign', campaignSchema); 