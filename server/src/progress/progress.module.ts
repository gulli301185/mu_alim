import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({ imports: [CoursesModule], controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
