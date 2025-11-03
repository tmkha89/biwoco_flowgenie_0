import { Expose } from 'class-transformer';

export class UserDto {
  @Expose()
  id: number;

  @Expose()
  username?: string;

  @Expose()
  email?: string;

  @Expose()
  name?: string;

  @Expose()
  avatar?: string;

  @Expose()
  googleLinked?: boolean;
}

export class AuthResponseDto {
  @Expose()
  access_token: string;

  @Expose()
  refresh_token: string;

  @Expose()
  expires_in: number;

  @Expose()
  user: UserDto;
}

