import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyEnrollments,
  isEnrolledInCourse,
  type CourseRef,
  type MyEnrollment,
} from '../lib/enrollments-api';

export const enrollmentKeys = {
  all: ['enrollments'] as const,
  mine: () => [...enrollmentKeys.all, 'mine'] as const,
};

export function useMyEnrollments() {
  const { token, isUser } = useAuth();

  const query = useQuery({
    queryKey: enrollmentKeys.mine(),
    queryFn: () => fetchMyEnrollments(token!),
    enabled: Boolean(token && isUser),
    staleTime: 30_000,
  });

  const enrollments: MyEnrollment[] = query.data?.items ?? [];

  const isEnrolledIn = useCallback(
    (courseRef: CourseRef) => isEnrolledInCourse(enrollments, courseRef),
    [enrollments],
  );

  return {
    enrollments,
    isEnrolledIn,
    isLoading: Boolean(token && isUser) && query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export function useCourseEnrollment(courseRef: CourseRef | null | undefined) {
  const { isUser, token } = useAuth();
  const { isEnrolledIn, isLoading, isFetching, refetch } = useMyEnrollments();

  const enrolled = courseRef ? isEnrolledIn(courseRef) : false;

  return {
    enrolled,
    isLoading: Boolean(token && isUser) && isLoading,
    isFetching,
    refetch,
    needsLogin: !token || !isUser,
  };
}
