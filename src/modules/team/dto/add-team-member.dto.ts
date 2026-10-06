import { IsString, IsUUID } from "class-validator";

export class AddTeamMemberDTO {
  @IsString()
  @IsUUID()
  userId!: string;
}
