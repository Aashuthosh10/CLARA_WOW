/**
 * Staff Availability API endpoints
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { StaffAvailabilityRepository } from '../repositories/StaffAvailabilityRepository.js';
import { StaffAvailability } from '../models/Call.js';

type AuthPayload = {
  userId: string;
  role: 'client' | 'staff';
  staffId?: string;
  dept?: string;
  tenant?: string;
  orgId?: string;
};

type AuthenticatedRequest = Request & { user?: AuthPayload };

export function createStaffRoutes(
  availabilityRepo: StaffAvailabilityRepository
): Router {
  const router = Router();

  // GET /v1/staff/availability - Get available staff
  router.get('/v1/staff/availability', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.query.orgId as string || req.user?.orgId || 'default';
      const skills = req.query.skills ? (req.query.skills as string).split(',') : undefined;

      const availableStaff = await availabilityRepo.findAvailableStaff(orgId, skills);
      res.json({ staff: availableStaff });
    } catch (error: any) {
      console.error('[Staff API] Error getting availability:', error);
      res.status(500).json({ error: 'Failed to get availability' });
    }
  });

  // POST /v1/staff/availability - Set availability status
  const availabilitySchema = z.object({
    status: z.enum(['available', 'busy', 'away', 'offline']),
    orgId: z.string().optional(),
    skills: z.array(z.string()).optional(),
  });

  router.post('/v1/staff/availability', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = availabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const user = req.user!;
      if (user.role !== 'staff') {
        return res.status(403).json({ error: 'Only staff can set availability' });
      }

      const { status, orgId, skills } = parsed.data;
      const effectiveOrgId = orgId || user.orgId || 'default';

      const availability: StaffAvailability = {
        userId: user.userId,
        orgId: effectiveOrgId,
        status,
        updatedAt: Date.now(),
        skills,
      };

      await availabilityRepo.setAvailability(availability);
      res.json({ success: true, availability });
    } catch (error: any) {
      console.error('[Staff API] Error setting availability:', error);
      res.status(500).json({ error: 'Failed to set availability' });
    }
  });

  // PUT /v1/staff/availability - Set availability status (alternative method)
  router.put('/v1/staff/availability', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = availabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const user = req.user!;
      if (user.role !== 'staff') {
        return res.status(403).json({ error: 'Only staff can set availability' });
      }

      const { status, orgId, skills } = parsed.data;
      const effectiveOrgId = orgId || user.orgId || 'default';

      const availability: StaffAvailability = {
        userId: user.userId,
        orgId: effectiveOrgId,
        status,
        updatedAt: Date.now(),
        skills,
      };

      await availabilityRepo.setAvailability(availability);
      res.json({ success: true, availability });
    } catch (error: any) {
      console.error('[Staff API] Error setting availability:', error);
      res.status(500).json({ error: 'Failed to set availability' });
    }
  });

  return router;
}

