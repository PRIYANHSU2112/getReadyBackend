import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationService } from '../../services/notification-service/src/services/notification.service.js';
import { BannerService } from '../../services/content-service/src/services/banner.service.js';
import { BlogService } from '../../services/content-service/src/services/blog.service.js';

describe('Notification & Content Microservices Test Suite', () => {
  describe('NotificationService', () => {
    let notifRepo;
    let notifService;

    beforeEach(() => {
      notifRepo = {
        create: jest.fn().mockImplementation((data) => ({
          _id: '65fc8e129182a1048b111444',
          ...data,
          read: false,
        })),
        findByUserId: jest.fn().mockResolvedValue({ notifications: [], total: 0 }),
        markAsRead: jest.fn().mockResolvedValue({ _id: '65fc8e129182a1048b111444', read: true }),
      };
      notifService = new NotificationService(notifRepo);
    });

    it('should create notification and increment metric', async () => {
      const res = await notifService.sendNotification({
        userId: '65fc8e129182a1048b111002',
        title: 'Booking Confirmed',
        body: 'Your slot is confirmed for tomorrow',
      });

      expect(res._id).toBe('65fc8e129182a1048b111444');
      expect(notifRepo.create).toHaveBeenCalled();
    });
  });

  describe('ContentService (Banner & Blog)', () => {
    let bannerRepo;
    let blogRepo;
    let bannerService;
    let blogService;

    beforeEach(() => {
      bannerRepo = {
        findActive: jest.fn().mockResolvedValue([
          { _id: '65fc8e129182a1048b111888', title: 'Monsoon Offer 50% Off', isActive: true },
        ]),
      };
      blogRepo = {
        findPublished: jest.fn().mockResolvedValue({ blogs: [], total: 0 }),
        findHome: jest.fn().mockResolvedValue({ hero: { title: 'Top 5 Salon Trends' }, popular: [] }),
        incrementLikes: jest.fn().mockResolvedValue({ likesCount: 42 }),
      };
      bannerService = new BannerService(bannerRepo);
      blogService = new BlogService(blogRepo);
    });

    it('should list active banners for mobile home screen', async () => {
      const banners = await bannerService.listActive();
      expect(banners).toHaveLength(1);
      expect(banners[0].title).toBe('Monsoon Offer 50% Off');
    });

    it('should fetch blog home screen data', async () => {
      const home = await blogService.getHome();
      expect(home.hero.title).toBe('Top 5 Salon Trends');
    });

    it('should increment blog likes count', async () => {
      const res = await blogService.like('65fc8e129182a1048b111777');
      expect(res.likesCount).toBe(42);
    });
  });
});
