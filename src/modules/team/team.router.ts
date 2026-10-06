import { Router } from "express";
import { container } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { AddTeamMemberDTO } from "./dto/add-team-member.dto";
import { CreateTeamDTO } from "./dto/create-team.dto";
import { QueryTeamMemberOptionsDTO } from "./dto/query-team-member-options.dto";
import { QueryTeamDTO } from "./dto/query-team.dto";
import { UpdateTeamDTO } from "./dto/update-team.dto";
import { TeamController } from "./team.controller";

export class TeamRouter {
  public readonly router: Router;
  private readonly controller: TeamController;

  constructor() {
    this.router = Router();
    this.controller = container.resolve(TeamController);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("admin.team.read"),
      validateQuery(QueryTeamDTO),
      this.controller.getTeams,
    );

    this.router.get(
      "/:id/member-options",
      requirePermissions("admin.team.manage_member"),
      validateQuery(QueryTeamMemberOptionsDTO),
      this.controller.getMemberOptions,
    );

    this.router.get(
      "/:id",
      requirePermissions("admin.team.read"),
      this.controller.getTeamById,
    );

    this.router.post(
      "/",
      requirePermissions("admin.team.create"),
      validateBody(CreateTeamDTO),
      this.controller.createTeam,
    );

    this.router.patch(
      "/:id",
      requirePermissions("admin.team.update"),
      validateBody(UpdateTeamDTO),
      this.controller.updateTeam,
    );

    this.router.delete(
      "/:id",
      requirePermissions("admin.team.delete"),
      this.controller.deleteTeam,
    );

    this.router.post(
      "/:id/members",
      requirePermissions("admin.team.manage_member"),
      validateBody(AddTeamMemberDTO),
      this.controller.addMember,
    );

    this.router.delete(
      "/:id/members/:userId",
      requirePermissions("admin.team.manage_member"),
      this.controller.removeMember,
    );
  }
}
