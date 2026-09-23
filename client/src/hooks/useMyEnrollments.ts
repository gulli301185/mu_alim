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
  mine: (token?: string | null) => [...enrollmentKeys.all, 'mine', token ?? 'anon'] as const,
};

export function useMyEnrollments() {
  const { token, isUser } = useAuth();

  const query = useQuery({
    queryKey: enrollmentKeys.mine(token),
    queryFn: () => fetchMyEnrollments(token!),
    enabled: Boolean(token && isUser),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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

  // While a fresh enrollment check is in flight, don't treat "not enrolled" as final —
  // otherwise a stale empty cache redirects away right after admin grants access.
  const accessPending =
    Boolean(token && isUser) && (isLoading || (isFetching && !enrolled));

  return {
    enrolled,
    isLoading: accessPending,
    isFetching,
    refetch,
    needsLogin: !token || !isUser,
  };
}
