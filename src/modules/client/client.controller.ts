import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ClientService } from "./client.service";
import { CreateClientDTO } from "./dto/create-client.dto";
import { QueryClientDTO } from "./dto/query-client.dto";
import { UpdateClientDTO } from "./dto/update-client.dto";

@injectable()
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  getAllClients = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const query = plainToInstance(QueryClientDTO, req.query);

      await validateOrReject(query);

      const result = await this.clientService.getAllClients(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar client berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getClientById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const client = await this.clientService.getClientById(id, user.id);

      res.status(200).json({
        success: true,
        data: client,
      });
    } catch (error) {
      next(error);
    }
  };

  createClient = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const data = plainToInstance(CreateClientDTO, req.body);

      await validateOrReject(data);

      const client = await this.clientService.createClient(data, user.id);

      res.status(201).json({
        success: true,
        message: "Client berhasil dibuat.",
        data: client,
      });
    } catch (error) {
      next(error);
    }
  };

  updateClient = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const data = plainToInstance(UpdateClientDTO, req.body);

      await validateOrReject(data);

      const client = await this.clientService.updateClient(id, data, user.id);

      res.status(200).json({
        success: true,
        message: "Client berhasil diperbarui.",
        data: client,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteClient = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const result = await this.clientService.deleteClient(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
