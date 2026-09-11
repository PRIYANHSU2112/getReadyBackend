import { LandingCmsModel } from '../models/landing.model.js';
import { FaqModel } from '../models/faq.model.js';

export class LandingRepository {
  async getLandingConfig() {
    let config = await LandingCmsModel.findOne({ key: 'default' }).lean();
    if (!config) {
      const created = await LandingCmsModel.create({ key: 'default' });
      config = created.toObject();
    }
    return config;
  }

  async updateLandingConfig(data) {
    return LandingCmsModel.findOneAndUpdate(
      { key: 'default' },
      { $set: data },
      { new: true, upsert: true },
    ).lean();
  }
}

export class FaqRepository {
  async listPublic() {
    let faqs = await FaqModel.find({ isPublished: true }).sort({ displayOrder: 1, createdAt: 1 }).lean();
    if (!faqs || faqs.length === 0) {
      // Seed default FAQs if empty
      const defaultFaqs = [
        {
          question: 'How does Get Ready home salon service work?',
          answer:
            'Simply choose your beauty treatments on our website or mobile app, select your preferred time slot, and a background-verified, certified beauty professional will arrive at your home with sterilized tools and single-use hygiene kits.',
          category: 'Booking',
          displayOrder: 1,
          isPublished: true,
        },
        {
          question: 'Are Get Ready beauty professionals verified and certified?',
          answer:
            'Yes. 100% of our professionals undergo strict government identity (Aadhaar/PAN) verification, criminal background checks, skill assessments, and standard hygiene protocol training.',
          category: 'Hygiene & Safety',
          displayOrder: 2,
          isPublished: true,
        },
        {
          question: 'Can I book for multiple family members in a single booking?',
          answer:
            'Absolutely! You can select treatments for Self, Mother, Sister, Wife, Daughter, or Friend all in one booking, with one invoice and transparent payment. You can also request 2 Beauticians for faster parallel service.',
          category: 'Booking',
          displayOrder: 3,
          isPublished: true,
        },
        {
          question: 'What is the Professional Hygiene Kit (₹49)?',
          answer:
            'Every booking includes one mandatory sealed safety & hygiene kit with single-use disposable bedsheets, headbands, sterilized manicure/pedicure tool pouches, and alcohol sanitization wipes to guarantee 100% sterile service.',
          category: 'Hygiene & Safety',
          displayOrder: 4,
          isPublished: true,
        },
        {
          question: 'What is Instant Service and who is eligible?',
          answer:
            'Instant Service enables dispatch of a certified professional to your doorstep within as little as 30 minutes. This premium feature is available to our GET READY Gold Members subject to real-time location availability.',
          category: 'Membership',
          displayOrder: 5,
          isPublished: true,
        },
        {
          question: 'What is the cancellation and refund policy?',
          answer:
            'Cancellations made 6 hours before the scheduled time are completely FREE. Between 6 to 2 hours, a nominal fee of up to ₹100 applies, and within 2 hours up to ₹200. If our professional is delayed, ALL cancellation fees are 100% waived.',
          category: 'Cancellation',
          displayOrder: 6,
          isPublished: true,
        },
        {
          question: 'How do Cashback and Loyalty Points work?',
          answer:
            'Every completed booking credits cashback and reward points directly into your GET READY Wallet, which you can use to pay for future beauty sessions or subscription plans.',
          category: 'Payment',
          displayOrder: 7,
          isPublished: true,
        },
      ];
      await FaqModel.insertMany(defaultFaqs);
      faqs = await FaqModel.find({ isPublished: true }).sort({ displayOrder: 1, createdAt: 1 }).lean();
    }
    return faqs;
  }

  async listAll() {
    return FaqModel.find().sort({ displayOrder: 1, createdAt: -1 }).lean();
  }

  async create(data) {
    return FaqModel.create(data);
  }

  async updateById(id, data) {
    return FaqModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return FaqModel.findByIdAndDelete(id);
  }
}
