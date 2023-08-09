(deftest conj-list-test
  (is (= l (conj '(2 3 4) 1)))
  (is (= l (conj '(3 4) 2 1))))