--
-- PostgreSQL database dump
--


-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: course_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.course_type AS ENUM (
    'free',
    'paid'
);


--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enrollment_status AS ENUM (
    'active',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'success',
    'failed',
    'refunded'
);


--
-- Name: qa_article_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qa_article_type AS ENUM (
    'text',
    'video'
);


--
-- Name: question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.question_type AS ENUM (
    'choice',
    'text'
);


--
-- Name: review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: test_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.test_type AS ENUM (
    'lesson',
    'final'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    slug character varying(180) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    certificate_number character varying(100) NOT NULL,
    verification_code uuid NOT NULL,
    pdf_file character varying(500) NOT NULL,
    recipient_name character varying(200),
    issued_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: course_instructors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_instructors (
    course_id uuid NOT NULL,
    instructor_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: course_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_progress (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    progress_percent numeric(5,2) DEFAULT 0 NOT NULL,
    last_lesson_id uuid,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(280) NOT NULL,
    short_description character varying(500),
    description text NOT NULL,
    cover_image character varying(500),
    course_type public.course_type NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'KGS'::character varying NOT NULL,
    level character varying(30),
    duration_minutes integer,
    passing_score numeric(5,2) DEFAULT 80 NOT NULL,
    is_popular boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    status public.enrollment_status NOT NULL,
    enrolled_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: faq_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_categories (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    slug character varying(180) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    source character varying(500),
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: hadiths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hadiths (
    id uuid NOT NULL,
    text text NOT NULL,
    source character varying(255) NOT NULL,
    explanation text,
    display_date date NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: hero_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hero_banners (
    id character varying(32) DEFAULT 'default'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    subtitle character varying(500) NOT NULL,
    name character varying(150) NOT NULL,
    sky_image_url character varying(500) NOT NULL,
    banner_image_url character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: instructors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructors (
    id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    photo character varying(500),
    education text,
    qualification text,
    experience text,
    specialization text,
    biography text,
    teaching_method text,
    achievements text,
    social_links jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_progress (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    video_progress_seconds integer DEFAULT 0 NOT NULL,
    is_video_completed boolean DEFAULT false NOT NULL,
    is_lesson_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    youtube_url character varying(500) NOT NULL,
    youtube_video_id character varying(50) NOT NULL,
    duration_seconds integer,
    lesson_order integer NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(10) NOT NULL,
    payment_method character varying(50) NOT NULL,
    transaction_id character varying(255) NOT NULL,
    status public.payment_status NOT NULL,
    provider_response jsonb,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: prayer_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_locations (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    country character varying(100) NOT NULL,
    region character varying(100),
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: qa_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_articles (
    id uuid NOT NULL,
    slug character varying(280) NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    excerpt character varying(500),
    tags text[] DEFAULT ARRAY[]::text[],
    type public.qa_article_type DEFAULT 'text'::public.qa_article_type NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    question_number integer,
    telegram_views integer DEFAULT 0 NOT NULL,
    site_views integer DEFAULT 0 NOT NULL
);


--
-- Name: question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_options (
    id uuid NOT NULL,
    question_id uuid NOT NULL,
    option_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    option_order integer NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    question_text text NOT NULL,
    explanation text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    correct_text_answer text,
    question_type public.question_type DEFAULT 'choice'::public.question_type NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    status public.review_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    display_name character varying(150),
    is_admin_posted boolean DEFAULT false NOT NULL,
    video_url character varying(500)
);


--
-- Name: site_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_images (
    key character varying(64) NOT NULL,
    url character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: teacher_question_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_question_submissions (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    question text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    answer text,
    answered_at timestamp with time zone,
    qa_article_id uuid,
    question_number integer
);


--
-- Name: test_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_answers (
    id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_id uuid,
    is_correct boolean NOT NULL,
    answered_at timestamp with time zone NOT NULL,
    text_answer text
);


--
-- Name: test_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_attempts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    test_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    total_questions integer NOT NULL,
    correct_answers integer DEFAULT 0 NOT NULL,
    score numeric(5,2) NOT NULL,
    passed boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: test_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_questions (
    test_id uuid NOT NULL,
    question_id uuid NOT NULL,
    question_order integer
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    lesson_id uuid,
    title character varying(255) NOT NULL,
    test_type public.test_type NOT NULL,
    questions_count integer NOT NULL,
    passing_score numeric(5,2) DEFAULT 80 NOT NULL,
    max_attempts integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(30),
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: course_instructors course_instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_instructors
    ADD CONSTRAINT course_instructors_pkey PRIMARY KEY (course_id, instructor_id);


--
-- Name: course_progress course_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: faq_categories faq_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_categories
    ADD CONSTRAINT faq_categories_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: hadiths hadiths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hadiths
    ADD CONSTRAINT hadiths_pkey PRIMARY KEY (id);


--
-- Name: hero_banners hero_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_banners
    ADD CONSTRAINT hero_banners_pkey PRIMARY KEY (id);


--
-- Name: instructors instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_pkey PRIMARY KEY (id);


--
-- Name: lesson_progress lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: prayer_locations prayer_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_locations
    ADD CONSTRAINT prayer_locations_pkey PRIMARY KEY (id);


--
-- Name: qa_articles qa_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_articles
    ADD CONSTRAINT qa_articles_pkey PRIMARY KEY (id);


--
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: site_images site_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_pkey PRIMARY KEY (key);


--
-- Name: teacher_question_submissions teacher_question_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_question_submissions
    ADD CONSTRAINT teacher_question_submissions_pkey PRIMARY KEY (id);


--
-- Name: test_answers test_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_answers
    ADD CONSTRAINT test_answers_pkey PRIMARY KEY (id);


--
-- Name: test_attempts test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);


--
-- Name: test_questions test_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_pkey PRIMARY KEY (test_id, question_id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: categories_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);


--
-- Name: certificates_certificate_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX certificates_certificate_number_key ON public.certificates USING btree (certificate_number);


--
-- Name: certificates_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX certificates_user_id_idx ON public.certificates USING btree (user_id);


--
-- Name: certificates_verification_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX certificates_verification_code_key ON public.certificates USING btree (verification_code);


--
-- Name: course_progress_user_id_course_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX course_progress_user_id_course_id_key ON public.course_progress USING btree (user_id, course_id);


--
-- Name: course_progress_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_progress_user_id_idx ON public.course_progress USING btree (user_id);


--
-- Name: courses_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_category_id_idx ON public.courses USING btree (category_id);


--
-- Name: courses_is_published_is_popular_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_is_published_is_popular_idx ON public.courses USING btree (is_published, is_popular);


--
-- Name: courses_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX courses_slug_key ON public.courses USING btree (slug);


--
-- Name: enrollments_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enrollments_course_id_idx ON public.enrollments USING btree (course_id);


--
-- Name: enrollments_user_id_course_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX enrollments_user_id_course_id_key ON public.enrollments USING btree (user_id, course_id);


--
-- Name: enrollments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enrollments_user_id_idx ON public.enrollments USING btree (user_id);


--
-- Name: faq_categories_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faq_categories_slug_key ON public.faq_categories USING btree (slug);


--
-- Name: faqs_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faqs_category_id_idx ON public.faqs USING btree (category_id);


--
-- Name: hadiths_display_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hadiths_display_date_key ON public.hadiths USING btree (display_date);


--
-- Name: lesson_progress_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_progress_user_id_idx ON public.lesson_progress USING btree (user_id);


--
-- Name: lesson_progress_user_id_lesson_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lesson_progress_user_id_lesson_id_key ON public.lesson_progress USING btree (user_id, lesson_id);


--
-- Name: lessons_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lessons_course_id_idx ON public.lessons USING btree (course_id);


--
-- Name: lessons_course_id_lesson_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lessons_course_id_lesson_order_key ON public.lessons USING btree (course_id, lesson_order);


--
-- Name: password_reset_tokens_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);


--
-- Name: password_reset_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens USING btree (user_id);


--
-- Name: payments_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_course_id_idx ON public.payments USING btree (course_id);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: payments_transaction_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_transaction_id_key ON public.payments USING btree (transaction_id);


--
-- Name: payments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_user_id_idx ON public.payments USING btree (user_id);


--
-- Name: qa_articles_is_published_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qa_articles_is_published_published_at_idx ON public.qa_articles USING btree (is_published, published_at DESC);


--
-- Name: qa_articles_is_published_question_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qa_articles_is_published_question_number_idx ON public.qa_articles USING btree (is_published, question_number);


--
-- Name: qa_articles_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX qa_articles_slug_key ON public.qa_articles USING btree (slug);


--
-- Name: qa_articles_views_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qa_articles_views_idx ON public.qa_articles USING btree (views DESC);


--
-- Name: question_options_question_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_options_question_id_idx ON public.question_options USING btree (question_id);


--
-- Name: questions_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_course_id_idx ON public.questions USING btree (course_id);


--
-- Name: reviews_course_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_course_id_status_idx ON public.reviews USING btree (course_id, status);


--
-- Name: reviews_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_status_created_at_idx ON public.reviews USING btree (status, created_at);


--
-- Name: teacher_question_submissions_answered_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_question_submissions_answered_at_idx ON public.teacher_question_submissions USING btree (answered_at DESC);


--
-- Name: teacher_question_submissions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_question_submissions_created_at_idx ON public.teacher_question_submissions USING btree (created_at DESC);


--
-- Name: teacher_question_submissions_qa_article_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teacher_question_submissions_qa_article_id_key ON public.teacher_question_submissions USING btree (qa_article_id);


--
-- Name: teacher_question_submissions_question_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_question_submissions_question_number_idx ON public.teacher_question_submissions USING btree (question_number DESC);


--
-- Name: test_answers_attempt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_answers_attempt_id_idx ON public.test_answers USING btree (attempt_id);


--
-- Name: test_attempts_user_id_test_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_attempts_user_id_test_id_idx ON public.test_attempts USING btree (user_id, test_id);


--
-- Name: tests_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_course_id_idx ON public.tests USING btree (course_id);


--
-- Name: tests_lesson_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_lesson_id_idx ON public.tests USING btree (lesson_id);


--
-- Name: user_profiles_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_profiles_user_id_key ON public.user_profiles USING btree (user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: certificates certificates_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: certificates certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: course_instructors course_instructors_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_instructors
    ADD CONSTRAINT course_instructors_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: course_instructors course_instructors_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_instructors
    ADD CONSTRAINT course_instructors_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: course_progress course_progress_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: course_progress course_progress_last_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_last_lesson_id_fkey FOREIGN KEY (last_lesson_id) REFERENCES public.lessons(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: course_progress course_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: courses courses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: enrollments enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faqs faqs_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.faq_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lessons lessons_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: qa_articles qa_articles_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_articles
    ADD CONSTRAINT qa_articles_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: question_options question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: questions questions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teacher_question_submissions teacher_question_submissions_qa_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_question_submissions
    ADD CONSTRAINT teacher_question_submissions_qa_article_id_fkey FOREIGN KEY (qa_article_id) REFERENCES public.qa_articles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_answers test_answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_answers
    ADD CONSTRAINT test_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_answers test_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_answers
    ADD CONSTRAINT test_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: test_answers test_answers_selected_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_answers
    ADD CONSTRAINT test_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.question_options(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_attempts test_attempts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_attempts test_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_questions test_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_questions test_questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tests tests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tests tests_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


