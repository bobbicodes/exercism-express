(deftest seqs-test
  (is (= n (first '(3 2 1))))
  (is (= n (second [2 3 4])))
  (is (= n (last (list 1 2 3)))))