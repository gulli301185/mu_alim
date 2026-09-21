import { Module } from '@nestjs/common';
import { TeacherQuestionsController } from './teacher-questions.controller';
import { TeacherQuestionsService } from './teacher-questions.service';

@Module({ controllers: [TeacherQuestionsController], providers: [TeacherQuestionsService] })
export class TeacherQuestionsModule {}
