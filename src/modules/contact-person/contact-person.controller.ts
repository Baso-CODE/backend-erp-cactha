import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ContactPersonService } from "./contact-person.service";
import { CreateContactPersonDTO } from "./dto/create-contact-person.dto";
import { QueryContactPersonDTO } from "./dto/query-contact-person.dto";
import { UpdateContactPersonDTO } from "./dto/update-contact-person.dto";

@injectable()
export class ContactPersonController {
  constructor(private readonly contactPersonService: ContactPersonService) {}

  getAllContactPersons = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryContactPersonDTO;

      const result = await this.contactPersonService.getAllContactPersons(
        query,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Daftar contact person berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getContactPersonById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const contact = await this.contactPersonService.getContactPersonById(
        id,
        user.id,
      );

      res.status(200).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };

  createContactPerson = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = req.body as CreateContactPersonDTO;

      const contact = await this.contactPersonService.createContactPerson(
        data,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Contact person berhasil dibuat.",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };

  updateContactPerson = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = req.body as UpdateContactPersonDTO;

      const contact = await this.contactPersonService.updateContactPerson(
        id,
        data,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Contact person berhasil diperbarui.",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteContactPerson = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const result = await this.contactPersonService.deleteContactPerson(
        id,
        user.id,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
