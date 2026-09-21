import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({ imports: [CoursesModule], controllers: [TestsController], providers: [TestsService] })
export class TestsModule {}
