import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import type { PublicUser } from "../../users/users.service.js";
import { AuthService } from "../auth.service.js";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, "local") {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "username", passwordField: "password" });
  }

  validate(username: string, password: string): Promise<PublicUser> {
    return this.authService.validateLocalUser(username, password);
  }
}
