import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({ imports: [CoursesModule], controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
