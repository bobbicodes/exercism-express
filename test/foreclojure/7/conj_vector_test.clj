(deftest conj-vectors-test
  (is (= v (conj [1 2 3] 4)))
  (is (= v (conj [1 2] 3 4))))